#!/usr/bin/env node

const fsp = require('node:fs/promises');
const path = require('node:path');
const {
  buildConfigurationSnapshot,
  captureDatabaseSnapshot,
  captureSystemIdentifier,
  createBackupFileBase,
  databaseIdentityDigest,
  encryptBufferToFile,
  encryptStreamToFile,
  ensurePrivateDirectory,
  openExportedSnapshot,
  parseDatabaseUrl,
  readEncryptionKey,
  requireEnvironment,
  sanitizeKeyId,
  sha256File,
  spawnPostgresTool
} = require('./backup-lib');

async function main(environment = process.env) {
  const databaseUrl = requireEnvironment('DATABASE_URL', environment);
  const outputDirectory = await ensurePrivateDirectory(
    requireEnvironment('BACKUP_OUTPUT_DIR', environment)
  );
  const key = await readEncryptionKey(
    requireEnvironment('BACKUP_ENCRYPTION_KEY_FILE', environment)
  );
  const keyId = sanitizeKeyId(requireEnvironment('BACKUP_KEY_ID', environment));
  const sourceEnvironment = requireEnvironment('APP_ENV', environment);
  if (!['local', 'test', 'staging', 'production'].includes(sourceEnvironment)) {
    throw new Error('APP_ENV must be local, test, staging, or production.');
  }
  const source = parseDatabaseUrl(databaseUrl);
  if (
    sourceEnvironment === 'production' &&
    (!environment.BACKUP_STORAGE_LABEL ||
      /^(?:local|localhost|local-secure-directory)$/i.test(environment.BACKUP_STORAGE_LABEL))
  ) {
    throw new Error(
      'Production backup requires BACKUP_STORAGE_LABEL for an off-host encrypted storage mount.'
    );
  }
  const createdAt = new Date();
  const base = createBackupFileBase(createdAt, keyId);
  const dumpPath = path.join(outputDirectory, `${base}.dump.enc`);
  const manifestPath = path.join(outputDirectory, `${base}.manifest.enc`);

  let dump = null;
  try {
    const systemIdentifier = await captureSystemIdentifier(source, environment);
    const exportedSnapshot = await openExportedSnapshot(source, environment);
    let snapshot;
    try {
      const snapshotPromise = captureDatabaseSnapshot(
        source,
        environment,
        exportedSnapshot.id
      );
      dump = spawnPostgresTool(
        'pg_dump',
        [
          '--format=custom',
          '--schema=public',
          '--no-owner',
          '--no-privileges',
          `--snapshot=${exportedSnapshot.id}`
        ],
        source,
        environment
      );
      let stderr = '';
      dump.stderr.setEncoding('utf8');
      dump.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      const dumpCompletion = new Promise((resolve, reject) => {
        dump.once('error', reject);
        dump.once('close', resolve);
      });
      dump.stdin.end();
      const [capturedSnapshot, exitCode] = await Promise.all([
        snapshotPromise,
        dumpCompletion,
        encryptStreamToFile(dump.stdout, dumpPath, key)
      ]);
      if (exitCode !== 0) {
        throw new Error(
          `pg_dump failed with exit code ${exitCode}: ${stderr.trim() || 'no details'}`
        );
      }
      snapshot = capturedSnapshot;
    } catch (error) {
      dump?.kill('SIGTERM');
      throw error;
    } finally {
      await exportedSnapshot.close();
    }

    const dumpStat = await fsp.stat(dumpPath);
    const manifest = {
      formatVersion: 1,
      createdAt: createdAt.toISOString(),
      sourceEnvironment,
      sourceIdentityDigest: databaseIdentityDigest(source, key),
      sourceSystemIdentifierDigest: databaseIdentityDigest(
        {
          host: 'postgres-system',
          port: '0',
          database: systemIdentifier
        },
        key
      ),
      storageLabel: environment.BACKUP_STORAGE_LABEL || 'local-secure-directory',
      keyId,
      releaseRevision: environment.RELEASE_REVISION || null,
      configuration: buildConfigurationSnapshot(environment),
      encryptedDump: {
        fileName: path.basename(dumpPath),
        bytes: dumpStat.size,
        sha256: await sha256File(dumpPath)
      },
      snapshot
    };
    await encryptBufferToFile(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), manifestPath, key);
    process.stdout.write(
      `${JSON.stringify({
        status: 'completed',
        dumpPath,
        manifestPath,
        createdAt: manifest.createdAt,
        keyId,
        tableCount: Object.keys(snapshot.tableCounts).length,
        migrationCount: Number(snapshot.migrations.appliedCount)
      })}\n`
    );
  } catch (error) {
    dump?.kill('SIGTERM');
    await Promise.all([
      fsp.rm(dumpPath, { force: true }),
      fsp.rm(manifestPath, { force: true })
    ]);
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`Backup failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
