import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  APPLICATION_TABLES,
  assertSafeRestoreTarget,
  buildPruneConfirmationToken,
  buildToolInvocation,
  createBackupFileBase,
  databaseIdentityDigest,
  decryptFileToBuffer,
  encryptBufferToFile,
  listBackupSets,
  parseDatabaseUrl,
  prepareEmptyRestoreTargetSchema,
  selectExpiredBackupSets,
  snapshotDifferenceSections
} = require('./backup-lib');

describe('database backup contract', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('tracks every Prisma application model in the restore count validation', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const models = [...schema.matchAll(/^model\s+([A-Za-z0-9_]+)\s+\{/gm)]
      .map((match) => match[1])
      .sort();

    expect(APPLICATION_TABLES).toEqual(models);
  });

  it('does not place the database password in native or Docker command arguments', () => {
    const database = parseDatabaseUrl(
      'postgresql://operator:do-not-leak@127.0.0.1:5432/sales_ai_system_test?sslmode=verify-full&sslrootcert=%2Fsecure%2Froot.crt&connect_timeout=10'
    );
    const native = buildToolInvocation('pg_dump', ['--format=custom'], database, {
      DB_OPS_MODE: 'native'
    });
    const docker = buildToolInvocation('pg_dump', ['--format=custom'], database, {
      DB_OPS_MODE: 'docker-compose'
    });

    expect(native.args.join(' ')).not.toContain('do-not-leak');
    expect(docker.args.join(' ')).not.toContain('do-not-leak');
    expect(native.environment.PGPASSWORD).toBe('do-not-leak');
    expect(docker.environment.PGPASSWORD).toBe('do-not-leak');
    expect(docker.args).toContain('PGPASSWORD');
    expect(native.environment.PGSSLMODE).toBe('verify-full');
    expect(native.environment.PGSSLROOTCERT).toBe('/secure/root.crt');
    expect(native.environment.PGCONNECT_TIMEOUT).toBe('10');
  });

  it('encrypts with authentication and rejects a modified backup', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sales-ai-backup-contract-'));
    temporaryDirectories.push(directory);
    const file = join(directory, 'payload.enc');
    const key = Buffer.alloc(32, 7);
    const payload = Buffer.from('confidential database payload');
    await encryptBufferToFile(payload, file, key);

    await expect(decryptFileToBuffer(file, key)).resolves.toEqual(payload);
    await expect(
      encryptBufferToFile(Buffer.from('replacement payload'), file, key)
    ).rejects.toMatchObject({ code: 'EEXIST' });
    await expect(decryptFileToBuffer(file, key)).resolves.toEqual(payload);

    const modified = await readFile(file);
    modified[Math.floor(modified.length / 2)] ^= 0xff;
    await writeFile(file, modified);
    await expect(decryptFileToBuffer(file, key)).rejects.toThrow();
  });

  it('rejects production, source, non-empty-name-pattern, mail-enabled, and unconfirmed targets', () => {
    const key = Buffer.alloc(32, 4);
    const source = parseDatabaseUrl(
      'postgresql://postgres:secret@db.internal:5432/sales_ai_system'
    );
    const safeTarget = parseDatabaseUrl(
      'postgresql://postgres:secret@restore.internal:5432/sales_ai_system_restore_test'
    );
    const manifest = {
      sourceIdentityDigest: databaseIdentityDigest(source, key)
    };
    const validEnvironment = {
      APP_ENV: 'test',
      RESTORE_TARGET_ENV: 'test',
      RESTORE_CONFIRM: 'RESTORE_TO_sales_ai_system_restore_test',
      MAIL_SEND_ENABLED: 'false'
    };

    expect(() => assertSafeRestoreTarget(safeTarget, manifest, key, validEnvironment)).not.toThrow();
    expect(() =>
      assertSafeRestoreTarget(safeTarget, manifest, key, {
        ...validEnvironment,
        APP_ENV: 'production'
      })
    ).toThrow(/production/);
    expect(() => assertSafeRestoreTarget(source, manifest, key, validEnvironment)).toThrow(
      /source database/
    );
    expect(() =>
      assertSafeRestoreTarget(
        parseDatabaseUrl('postgresql://postgres:secret@restore.internal:5432/sales_ai_system'),
        manifest,
        key,
        validEnvironment
      )
    ).toThrow(/database name/);
    expect(() =>
      assertSafeRestoreTarget(
        parseDatabaseUrl('postgresql://postgres:secret@restore.internal:5432/contest'),
        manifest,
        key,
        {
          ...validEnvironment,
          RESTORE_CONFIRM: 'RESTORE_TO_contest'
        }
      )
    ).toThrow(/database name/);
    expect(() =>
      assertSafeRestoreTarget(safeTarget, manifest, key, {
        ...validEnvironment,
        MAIL_SEND_ENABLED: 'true'
      })
    ).toThrow(/MAIL_SEND_ENABLED/);
    expect(() =>
      assertSafeRestoreTarget(safeTarget, manifest, key, {
        ...validEnvironment,
        RESTORE_CONFIRM: 'yes'
      })
    ).toThrow(/RESTORE_CONFIRM/);
  });

  it('only selects paired backup files owned by this application for retention', () => {
    const directory = '/secure/backups';
    const sets = listBackupSets([
      {
        name: 'sales-ai-system-20260725T010203Z-key-2026.dump.enc',
        path: `${directory}/sales-ai-system-20260725T010203Z-key-2026.dump.enc`,
        modifiedAt: 200
      },
      {
        name: 'sales-ai-system-20260725T010203Z-key-2026.manifest.enc',
        path: `${directory}/sales-ai-system-20260725T010203Z-key-2026.manifest.enc`,
        modifiedAt: 201
      },
      {
        name: 'other-system-20260725T010203Z-key.dump.enc',
        path: `${directory}/other-system-20260725T010203Z-key.dump.enc`,
        modifiedAt: 300
      },
      {
        name: 'sales-ai-system-20260724T010203Z-key-2026.dump.enc',
        path: `${directory}/sales-ai-system-20260724T010203Z-key-2026.dump.enc`,
        modifiedAt: 100
      },
      {
        name: 'sales-ai-system-20260724T010203Z-key-2026.manifest.enc',
        path: `${directory}/sales-ai-system-20260724T010203Z-key-2026.manifest.enc`,
        modifiedAt: 101
      }
    ]);

    expect(sets.map((set: { base: string }) => set.base)).toEqual([
      'sales-ai-system-20260725T010203Z-key-2026',
      'sales-ai-system-20260724T010203Z-key-2026'
    ]);
    expect(sets[0].manifestPath).toBe(
      `${directory}/sales-ai-system-20260725T010203Z-key-2026.manifest.enc`
    );
  });

  it('keeps the newest minimum generations even when every backup is expired', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    const backupSets = Array.from({ length: 10 }, (_, index) => ({
      base: `backup-${index}`,
      modifiedAt: now - (40 + index) * day
    }));

    expect(
      selectExpiredBackupSets(backupSets, now, 35, 7).map(
        (set: { base: string }) => set.base
      )
    ).toEqual(['backup-7', 'backup-8', 'backup-9']);
  });

  it('uses unique backup names and binds prune confirmation to the authenticated plan', () => {
    const date = new Date('2026-07-25T01:02:03.000Z');
    const first = createBackupFileBase(date, 'key-2026', 'a'.repeat(32));
    const second = createBackupFileBase(date, 'key-2026', 'b'.repeat(32));
    expect(first).not.toBe(second);

    const key = Buffer.alloc(32, 9);
    const plan = [
      {
        base: first,
        createdAt: date.toISOString(),
        storageLabel: 'operations-object-storage-production',
        dumpSha256: 'a'.repeat(64)
      }
    ];
    const token = buildPruneConfirmationToken(plan, key, '/secure/backups');
    expect(token).toMatch(/^DELETE_[A-F0-9]{24}$/);
    expect(
      buildPruneConfirmationToken(
        [{ ...plan[0], base: second }],
        key,
        '/secure/backups'
      )
    ).not.toBe(token);
    expect(
      buildPruneConfirmationToken(
        [{ ...plan[0], dumpSha256: 'b'.repeat(64) }],
        key,
        '/secure/backups'
      )
    ).not.toBe(token);
  });

  it('reports snapshot mismatch sections without serializing database details', () => {
    expect(
      snapshotDifferenceSections(
        {
          tableCounts: { Company: 1 },
          migrations: { appliedCount: 16 },
          schema: { publicTables: 27 },
          relationViolations: { leadCompany: 0 }
        },
        {
          tableCounts: { Company: 1 },
          migrations: { appliedCount: 16 },
          schema: { publicTables: 26 },
          relationViolations: { leadCompany: 0 }
        }
      )
    ).toEqual(['schema']);
  });

  it('prepares restore targets without destructive schema cleanup options', () => {
    const implementation = prepareEmptyRestoreTargetSchema.toString();

    expect(implementation).toContain('DROP SCHEMA IF EXISTS public;');
    expect(implementation).not.toMatch(/CASCADE/i);
  });
});
