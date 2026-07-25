const {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID
} = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Transform, Writable } = require('node:stream');

const ENCRYPTED_FILE_MAGIC = Buffer.from('SAIBAK01', 'ascii');
const ENCRYPTED_FILE_HEADER_BYTES = ENCRYPTED_FILE_MAGIC.length + 12;
const AUTH_TAG_BYTES = 16;
const DEFAULT_RETENTION_DAYS = 35;
const DEFAULT_MINIMUM_BACKUPS = 7;
const RESTORE_TARGET_DATABASE_COMMENT = 'sales-ai-system:restore-only';

const APPLICATION_TABLES = [
  'AiGeneration',
  'AiUsageLedger',
  'AuditLog',
  'Company',
  'ContactPerson',
  'CrowdfundingPlatform',
  'CrowdfundingProject',
  'EmailEvent',
  'EmailReply',
  'LeadAnalysisRevision',
  'LeadScore',
  'LinkClick',
  'MailAttachment',
  'MailChecklistItem',
  'MailTemplate',
  'Opportunity',
  'OpportunityStageHistory',
  'Organization',
  'OrganizationMembership',
  'OutreachEmail',
  'ProjectSearchJob',
  'SalesLead',
  'Task',
  'TrackedLink',
  'User',
  'UserSession'
];

const CONFIG_SNAPSHOT_KEYS = [
  'APP_ENV',
  'AUTH_MODE',
  'MAIL_SEND_ENABLED',
  'MAIL_SENDER_PROVIDER',
  'AI_DEFAULT_MODEL',
  'OPENAI_MODEL'
];

function requireEnvironment(name, environment = process.env) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Database URL is invalid.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('Only PostgreSQL database URLs are supported.');
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!database) throw new Error('Database URL must include a database name.');
  const connectionEnvironment = {};
  const queryEnvironmentMap = new Map([
    ['sslmode', 'PGSSLMODE'],
    ['sslrootcert', 'PGSSLROOTCERT'],
    ['sslcert', 'PGSSLCERT'],
    ['sslkey', 'PGSSLKEY'],
    ['sslcrl', 'PGSSLCRL'],
    ['sslcrldir', 'PGSSLCRLDIR'],
    ['channel_binding', 'PGCHANNELBINDING'],
    ['connect_timeout', 'PGCONNECT_TIMEOUT'],
    ['gssencmode', 'PGGSSENCMODE'],
    ['target_session_attrs', 'PGTARGETSESSIONATTRS']
  ]);
  for (const [queryName, environmentName] of queryEnvironmentMap) {
    const queryValue = parsed.searchParams.get(queryName);
    if (queryValue) connectionEnvironment[environmentName] = queryValue;
  }
  if (
    connectionEnvironment.PGSSLMODE &&
    !['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].includes(
      connectionEnvironment.PGSSLMODE
    )
  ) {
    throw new Error('Database URL sslmode is invalid.');
  }
  if (
    connectionEnvironment.PGCONNECT_TIMEOUT &&
    !/^\d+$/.test(connectionEnvironment.PGCONNECT_TIMEOUT)
  ) {
    throw new Error('Database URL connect_timeout must be an integer.');
  }
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectionEnvironment
  };
}

function databaseIdentity(config) {
  return `${config.host.toLowerCase()}:${config.port}/${config.database}`;
}

function databaseIdentityDigest(config, key) {
  return createHmac('sha256', key).update(databaseIdentity(config)).digest('hex');
}

async function readEncryptionKey(keyFilePath) {
  const resolved = path.resolve(keyFilePath);
  const stat = await fsp.stat(resolved);
  if (!stat.isFile()) throw new Error('BACKUP_ENCRYPTION_KEY_FILE must point to a regular file.');
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    throw new Error('Backup encryption key file must not be readable or writable by group/others.');
  }

  const raw = (await fsp.readFile(resolved)).toString('utf8').trim();
  let key;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) key = Buffer.from(raw, 'base64');
  else key = Buffer.from(raw, 'utf8');
  if (key.length !== 32) {
    throw new Error('Backup encryption key must decode to exactly 32 bytes.');
  }
  return key;
}

async function ensurePrivateDirectory(directory) {
  const resolved = path.resolve(directory);
  await fsp.mkdir(resolved, { recursive: true, mode: 0o700 });
  const stat = await fsp.stat(resolved);
  if (!stat.isDirectory()) throw new Error('BACKUP_OUTPUT_DIR must be a directory.');
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    throw new Error('Backup output directory must not be accessible by group/others.');
  }
  return resolved;
}

function buildPostgresEnvironment(config, mode, environment = process.env) {
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const host =
    mode === 'docker-compose' && localHosts.has(config.host)
      ? environment.DB_OPS_DOCKER_HOST || '127.0.0.1'
      : config.host;
  return {
    ...environment,
    ...config.connectionEnvironment,
    PGHOST: host,
    PGPORT: config.port,
    PGUSER: config.user,
    PGPASSWORD: config.password,
    PGDATABASE: config.database
  };
}

function buildToolInvocation(tool, args, config, environment = process.env) {
  const mode = environment.DB_OPS_MODE || 'native';
  if (!['native', 'docker-compose'].includes(mode)) {
    throw new Error('DB_OPS_MODE must be native or docker-compose.');
  }
  const pgEnvironment = buildPostgresEnvironment(config, mode, environment);
  if (mode === 'native') {
    return { command: tool, args, environment: pgEnvironment };
  }
  const service = environment.DB_OPS_DOCKER_SERVICE || 'postgres';
  const variableArgs = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'].flatMap(
    (name) => ['-e', name]
  );
  return {
    command: 'docker',
    args: ['compose', 'exec', '-T', ...variableArgs, service, tool, ...args],
    environment: pgEnvironment
  };
}

function spawnPostgresTool(tool, args, config, environment = process.env) {
  const invocation = buildToolInvocation(tool, args, config, environment);
  return spawn(invocation.command, invocation.args, {
    env: invocation.environment,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

async function runPostgresText(tool, args, config, environment = process.env) {
  const child = spawnPostgresTool(tool, args, config, environment);
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.stdin.end();
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (exitCode !== 0) {
    throw new Error(`${tool} failed with exit code ${exitCode}: ${stderr.trim() || 'no details'}`);
  }
  return stdout.trim();
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildSnapshotSql() {
  const countPairs = APPLICATION_TABLES.flatMap((table) => [
    `'${table}'`,
    `(SELECT count(*) FROM ${quoteIdentifier(table)})`
  ]);
  return `
SELECT json_build_object(
  'tableCounts', json_build_object(${countPairs.join(', ')}),
  'migrations', json_build_object(
    'appliedCount', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'failedCount', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL),
    'names', COALESCE((SELECT json_agg(migration_name ORDER BY started_at) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), '[]'::json)
  ),
  'schema', json_build_object(
    'publicTables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
    'publicIndexes', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'),
    'unvalidatedConstraints', (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND NOT c.convalidated),
    'columns', COALESCE((
      SELECT json_agg(
        row_to_json(column_definition_row)
        ORDER BY column_definition_row.table_name, column_definition_row.column_name
      )
      FROM (
        SELECT
          c.relname AS table_name,
          a.attname AS column_name,
          format_type(a.atttypid, a.atttypmod) AS data_type,
          a.attnotnull AS not_null,
          COALESCE(pg_get_expr(d.adbin, d.adrelid), '') AS default_expression,
          a.attidentity AS identity_kind,
          a.attgenerated AS generated_kind
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attnum > 0
          AND NOT a.attisdropped
      ) column_definition_row
    ), '[]'::json),
    'constraints', COALESCE((
      SELECT json_agg(
        row_to_json(constraint_definition_row)
        ORDER BY constraint_definition_row.table_name, constraint_definition_row.constraint_name
      )
      FROM (
        SELECT
          c.relname AS table_name,
          constraint_row.conname AS constraint_name,
          constraint_row.contype AS constraint_type,
          constraint_row.convalidated AS validated,
          pg_get_constraintdef(constraint_row.oid, true) AS constraint_sql
        FROM pg_constraint constraint_row
        JOIN pg_class c ON c.oid = constraint_row.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
      ) constraint_definition_row
    ), '[]'::json),
    'indexes', COALESCE((
      SELECT json_agg(
        json_build_object(
          'table_name', tablename,
          'index_name', indexname,
          'definition', indexdef
        )
        ORDER BY tablename, indexname
      )
      FROM pg_indexes
      WHERE schemaname = 'public'
    ), '[]'::json),
    'enums', COALESCE((
      SELECT json_agg(
        json_build_object(
          'type_name', type_row.typname,
          'label', enum_row.enumlabel,
          'sort_order', enum_row.enumsortorder
        )
        ORDER BY type_row.typname, enum_row.enumsortorder
      )
      FROM pg_type type_row
      JOIN pg_enum enum_row ON enum_row.enumtypid = type_row.oid
      JOIN pg_namespace n ON n.oid = type_row.typnamespace
      WHERE n.nspname = 'public'
    ), '[]'::json)
  ),
  'relationViolations', json_build_object(
    'membershipUser', (SELECT count(*) FROM "OrganizationMembership" m LEFT JOIN "User" u ON u.id = m."userId" WHERE u.id IS NULL),
    'leadCompany', (SELECT count(*) FROM "SalesLead" l LEFT JOIN "Company" c ON c.id = l."companyId" AND c."organizationId" = l."organizationId" WHERE c.id IS NULL),
    'leadProject', (SELECT count(*) FROM "SalesLead" l LEFT JOIN "CrowdfundingProject" p ON p.id = l."projectId" AND p."organizationId" = l."organizationId" WHERE l."projectId" IS NOT NULL AND p.id IS NULL),
    'mailCompany', (SELECT count(*) FROM "OutreachEmail" e LEFT JOIN "Company" c ON c.id = e."companyId" AND c."organizationId" = e."organizationId" WHERE c.id IS NULL),
    'mailLead', (SELECT count(*) FROM "OutreachEmail" e LEFT JOIN "SalesLead" l ON l.id = e."leadId" AND l."organizationId" = e."organizationId" WHERE e."leadId" IS NOT NULL AND l.id IS NULL),
    'opportunityLead', (SELECT count(*) FROM "Opportunity" o LEFT JOIN "SalesLead" l ON l.id = o."leadId" AND l."organizationId" = o."organizationId" WHERE l.id IS NULL)
  )
)::text;`.trim();
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function captureDatabaseSnapshot(config, environment = process.env, snapshotId = null) {
  const sql = snapshotId
    ? [
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;',
        `SET TRANSACTION SNAPSHOT ${quoteLiteral(snapshotId)};`,
        buildSnapshotSql(),
        'COMMIT;'
      ].join('\n')
    : buildSnapshotSql();
  const output = await runPostgresText(
    'psql',
    [
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--quiet',
      '--command',
      sql
    ],
    config,
    environment
  );
  const snapshot = JSON.parse(output);
  assertNoRelationViolations(snapshot);
  return snapshot;
}

async function openExportedSnapshot(config, environment = process.env) {
  const child = spawnPostgresTool(
    'psql',
    ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--quiet'],
    config,
    environment
  );
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let stderr = '';
  let output = '';
  let closed = false;
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolve) => {
    child.once('close', (exitCode) => {
      closed = true;
      resolve(exitCode);
    });
  });
  let snapshotId;
  try {
    snapshotId = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out while exporting the PostgreSQL snapshot.'));
      }, 10_000);
      const fail = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
      const failOnClose = (exitCode) => {
        fail(
          new Error(
            `Snapshot exporter exited before returning an identifier with code ${exitCode}: ${
              stderr.trim() || 'no details'
            }`
          )
        );
      };
      child.once('error', fail);
      child.once('close', failOnClose);
      child.stdout.on('data', (chunk) => {
        output += chunk;
        const line = output
          .split(/\r?\n/)
          .map((value) => value.trim())
          .find(Boolean);
        if (!line) return;
        clearTimeout(timeout);
        child.removeListener('error', fail);
        child.removeListener('close', failOnClose);
        resolve(line);
      });
      child.stdin.write(
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n'
      );
    });
  } catch (error) {
    if (!closed) child.kill('SIGTERM');
    await completion;
    throw error;
  }

  if (!/^[A-Za-z0-9:-]+$/.test(snapshotId)) {
    child.kill('SIGTERM');
    await completion;
    throw new Error('PostgreSQL returned an invalid exported snapshot identifier.');
  }

  return {
    id: snapshotId,
    close: async () => {
      if (!closed) child.stdin.end('ROLLBACK;\n\\q\n');
      const exitCode = await completion;
      if (exitCode !== 0) {
        throw new Error(
          `Snapshot exporter failed with exit code ${exitCode}: ${stderr.trim() || 'no details'}`
        );
      }
    }
  };
}

function assertNoRelationViolations(snapshot) {
  const violations = Object.entries(snapshot.relationViolations || {}).filter(
    ([, count]) => Number(count) !== 0
  );
  if (violations.length) {
    throw new Error(
      `Database relation validation failed: ${violations.map(([name, count]) => `${name}=${count}`).join(', ')}`
    );
  }
  if (Number(snapshot.migrations?.failedCount) !== 0) {
    throw new Error(`Database has ${snapshot.migrations.failedCount} unfinished migration(s).`);
  }
  if (Number(snapshot.schema?.unvalidatedConstraints) !== 0) {
    throw new Error(
      `Database has ${snapshot.schema.unvalidatedConstraints} unvalidated constraint(s).`
    );
  }
}

function snapshotsMatch(expected, actual) {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

function snapshotDifferenceSections(expected, actual) {
  return ['tableCounts', 'migrations', 'schema', 'relationViolations'].filter(
    (section) => JSON.stringify(expected?.[section]) !== JSON.stringify(actual?.[section])
  );
}

function createEncryptTransform(key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let headerWritten = false;
  return new Transform({
    transform(chunk, encoding, callback) {
      try {
        if (!headerWritten) {
          this.push(Buffer.concat([ENCRYPTED_FILE_MAGIC, iv]));
          headerWritten = true;
        }
        this.push(cipher.update(chunk));
        callback();
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        if (!headerWritten) this.push(Buffer.concat([ENCRYPTED_FILE_MAGIC, iv]));
        this.push(cipher.final());
        this.push(cipher.getAuthTag());
        callback();
      } catch (error) {
        callback(error);
      }
    }
  });
}

async function encryptBufferToFile(buffer, outputPath, key) {
  const temporaryPath = `${outputPath}.partial-${process.pid}-${randomUUID()}`;
  const source = require('node:stream').Readable.from(buffer);
  const destination = fs.createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
  try {
    await pipeline(source, createEncryptTransform(key), destination);
    await publishTemporaryFileWithoutOverwrite(temporaryPath, outputPath);
  } catch (error) {
    await fsp.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function encryptStreamToFile(source, outputPath, key) {
  const temporaryPath = `${outputPath}.partial-${process.pid}-${randomUUID()}`;
  const destination = fs.createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 });
  try {
    await pipeline(source, createEncryptTransform(key), destination);
    await publishTemporaryFileWithoutOverwrite(temporaryPath, outputPath);
  } catch (error) {
    await fsp.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function publishTemporaryFileWithoutOverwrite(temporaryPath, outputPath) {
  try {
    await fsp.link(temporaryPath, outputPath);
  } catch (error) {
    if (!['EXDEV', 'ENOTSUP', 'EOPNOTSUPP', 'EPERM'].includes(error?.code)) throw error;
    await fsp.copyFile(temporaryPath, outputPath, fs.constants.COPYFILE_EXCL);
  }
  await fsp.rm(temporaryPath, { force: true });
}

async function decryptFileToBuffer(inputPath, key) {
  const encrypted = await fsp.readFile(inputPath);
  if (encrypted.length < ENCRYPTED_FILE_HEADER_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Encrypted backup file is truncated.');
  }
  if (!encrypted.subarray(0, ENCRYPTED_FILE_MAGIC.length).equals(ENCRYPTED_FILE_MAGIC)) {
    throw new Error('Encrypted backup file has an invalid format.');
  }
  const iv = encrypted.subarray(ENCRYPTED_FILE_MAGIC.length, ENCRYPTED_FILE_HEADER_BYTES);
  const tag = encrypted.subarray(encrypted.length - AUTH_TAG_BYTES);
  const ciphertext = encrypted.subarray(ENCRYPTED_FILE_HEADER_BYTES, encrypted.length - AUTH_TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function createEncryptedFileDecryptStreams(inputPath, key) {
  const stat = await fsp.stat(inputPath);
  if (stat.size < ENCRYPTED_FILE_HEADER_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Encrypted backup file is truncated.');
  }
  const descriptor = await fsp.open(inputPath, 'r');
  const header = Buffer.alloc(ENCRYPTED_FILE_HEADER_BYTES);
  const tag = Buffer.alloc(AUTH_TAG_BYTES);
  try {
    await descriptor.read(header, 0, header.length, 0);
    await descriptor.read(tag, 0, tag.length, stat.size - AUTH_TAG_BYTES);
  } finally {
    await descriptor.close();
  }
  if (!header.subarray(0, ENCRYPTED_FILE_MAGIC.length).equals(ENCRYPTED_FILE_MAGIC)) {
    throw new Error('Encrypted backup file has an invalid format.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    header.subarray(ENCRYPTED_FILE_MAGIC.length)
  );
  decipher.setAuthTag(tag);
  return {
    source: fs.createReadStream(inputPath, {
      start: ENCRYPTED_FILE_HEADER_BYTES,
      end: stat.size - AUTH_TAG_BYTES - 1
    }),
    decipher
  };
}

async function authenticateEncryptedFile(inputPath, key) {
  const { source, decipher } = await createEncryptedFileDecryptStreams(inputPath, key);
  await pipeline(
    source,
    decipher,
    new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      }
    })
  );
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function captureSystemIdentifier(config, environment = process.env) {
  return runPostgresText(
    'psql',
    [
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--command',
      'SELECT system_identifier FROM pg_control_system();'
    ],
    config,
    environment
  );
}

function buildConfigurationSnapshot(environment = process.env) {
  return Object.fromEntries(
    CONFIG_SNAPSHOT_KEYS.filter((key) => environment[key] !== undefined).map((key) => [
      key,
      environment[key]
    ])
  );
}

function sanitizeKeyId(value) {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(value)) {
    throw new Error('BACKUP_KEY_ID may contain only letters, numbers, dot, underscore, and hyphen.');
  }
  return value;
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function createBackupFileBase(date, keyId, uniqueId = randomUUID()) {
  const safeUniqueId = uniqueId.replaceAll('-', '');
  if (!/^[A-Za-z0-9]{16,64}$/.test(safeUniqueId)) {
    throw new Error('Backup unique identifier is invalid.');
  }
  return `sales-ai-system-${timestampForFile(date)}-${sanitizeKeyId(keyId)}-${safeUniqueId}`;
}

function assertSafeRestoreTarget(target, manifest, key, environment = process.env) {
  const appEnvironment = requireEnvironment('APP_ENV', environment);
  if (appEnvironment === 'production') {
    throw new Error('Restore is forbidden while APP_ENV=production.');
  }
  const targetEnvironment = requireEnvironment('RESTORE_TARGET_ENV', environment);
  if (!['staging', 'test', 'restore'].includes(targetEnvironment)) {
    throw new Error('RESTORE_TARGET_ENV must be staging, test, or restore.');
  }
  if (databaseIdentityDigest(target, key) === manifest.sourceIdentityDigest) {
    throw new Error('Restore target must not be the backup source database.');
  }
  if (!/(?:^|[_-])(?:staging|test|restore)(?:[_-]|$)/i.test(target.database)) {
    throw new Error('Restore target database name must contain staging, test, or restore.');
  }
  if (environment.MAIL_SEND_ENABLED !== 'false') {
    throw new Error('MAIL_SEND_ENABLED must be explicitly set to false for restore.');
  }
  const expectedConfirmation = `RESTORE_TO_${target.database}`;
  if (environment.RESTORE_CONFIRM !== expectedConfirmation) {
    throw new Error(`RESTORE_CONFIRM must exactly equal ${expectedConfirmation}.`);
  }
}

async function assertRestoreTargetMarker(config, environment = process.env) {
  const output = await runPostgresText(
    'psql',
    [
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--command',
      "SELECT COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = current_database();"
    ],
    config,
    environment
  );
  if (output !== RESTORE_TARGET_DATABASE_COMMENT) {
    throw new Error(
      `Restore target database must be marked with COMMENT ON DATABASE ... IS '${RESTORE_TARGET_DATABASE_COMMENT}'.`
    );
  }
}

async function assertEmptyRestoreTarget(config, environment = process.env) {
  const output = await runPostgresText(
    'psql',
    [
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--command',
      "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
    ],
    config,
    environment
  );
  if (Number(output) !== 0) {
    throw new Error('Restore target must be an empty database with no public tables.');
  }
}

async function prepareEmptyRestoreTargetSchema(config, environment = process.env) {
  await runPostgresText(
    'psql',
    [
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      'DROP SCHEMA IF EXISTS public;'
    ],
    config,
    environment
  );
}

async function restoreEncryptedDump(inputPath, key, config, environment = process.env) {
  await authenticateEncryptedFile(inputPath, key);
  const child = spawnPostgresTool(
    'pg_restore',
    [
      '--dbname',
      config.database,
      '--exit-on-error',
      '--no-owner',
      '--no-privileges',
      '--single-transaction'
    ],
    config,
    environment
  );
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const { source, decipher } = await createEncryptedFileDecryptStreams(inputPath, key);
  const [, exitCode] = await Promise.all([
    pipeline(source, decipher, child.stdin),
    completion
  ]);
  if (exitCode !== 0) {
    throw new Error(`pg_restore failed with exit code ${exitCode}: ${stderr.trim() || 'no details'}`);
  }
}

function listBackupSets(entries) {
  const dumpPattern = /^sales-ai-system-(\d{8}T\d{6}Z)-([A-Za-z0-9._-]+)\.dump\.enc$/;
  const fileNames = new Set(entries.map((entry) => entry.name));
  const byBase = new Map();
  for (const entry of entries) {
    const match = entry.name.match(dumpPattern);
    if (!match) continue;
    const base = entry.name.replace(/\.dump\.enc$/, '');
    const manifestName = `${base}.manifest.enc`;
    if (!fileNames.has(manifestName)) continue;
    byBase.set(base, {
      base,
      timestamp: match[1],
      keyId: match[2],
      dumpPath: entry.path,
      manifestPath: path.join(path.dirname(entry.path), manifestName),
      modifiedAt: entry.modifiedAt
    });
  }
  return [...byBase.values()].sort((left, right) => right.modifiedAt - left.modifiedAt);
}

function selectExpiredBackupSets(
  backupSets,
  now = Date.now(),
  retentionDays = DEFAULT_RETENTION_DAYS,
  minimumBackups = DEFAULT_MINIMUM_BACKUPS
) {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  return backupSets.filter(
    (set, index) =>
      index >= minimumBackups &&
      Number(set.createdAtMs ?? set.modifiedAt) < cutoff
  );
}

function buildPruneConfirmationToken(backupSets, key, outputDirectory) {
  const plan = backupSets.map((set) => ({
    base: set.base,
    createdAt: set.createdAt,
    storageLabel: set.storageLabel,
    dumpSha256: set.dumpSha256
  }));
  const digest = createHmac('sha256', key)
    .update(JSON.stringify({ outputDirectory: path.resolve(outputDirectory), plan }))
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();
  return `DELETE_${digest}`;
}

module.exports = {
  APPLICATION_TABLES,
  AUTH_TAG_BYTES,
  CONFIG_SNAPSHOT_KEYS,
  DEFAULT_MINIMUM_BACKUPS,
  DEFAULT_RETENTION_DAYS,
  ENCRYPTED_FILE_HEADER_BYTES,
  ENCRYPTED_FILE_MAGIC,
  RESTORE_TARGET_DATABASE_COMMENT,
  assertEmptyRestoreTarget,
  assertNoRelationViolations,
  assertRestoreTargetMarker,
  assertSafeRestoreTarget,
  authenticateEncryptedFile,
  buildPruneConfirmationToken,
  buildConfigurationSnapshot,
  buildPostgresEnvironment,
  buildSnapshotSql,
  buildToolInvocation,
  captureDatabaseSnapshot,
  captureSystemIdentifier,
  createBackupFileBase,
  databaseIdentityDigest,
  decryptFileToBuffer,
  encryptBufferToFile,
  encryptStreamToFile,
  ensurePrivateDirectory,
  listBackupSets,
  parseDatabaseUrl,
  parsePositiveInteger,
  prepareEmptyRestoreTargetSchema,
  readEncryptionKey,
  requireEnvironment,
  restoreEncryptedDump,
  runPostgresText,
  sanitizeKeyId,
  selectExpiredBackupSets,
  sha256File,
  snapshotDifferenceSections,
  snapshotsMatch,
  spawnPostgresTool,
  timestampForFile,
  openExportedSnapshot
};
