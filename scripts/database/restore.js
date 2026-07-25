#!/usr/bin/env node

const path = require('node:path');
const {
  assertEmptyRestoreTarget,
  assertRestoreTargetMarker,
  assertSafeRestoreTarget,
  captureDatabaseSnapshot,
  captureSystemIdentifier,
  databaseIdentityDigest,
  decryptFileToBuffer,
  parseDatabaseUrl,
  prepareEmptyRestoreTargetSchema,
  readEncryptionKey,
  requireEnvironment,
  restoreEncryptedDump,
  sha256File,
  snapshotDifferenceSections,
  snapshotsMatch
} = require('./backup-lib');

async function main(environment = process.env) {
  const backupPath = path.resolve(requireEnvironment('BACKUP_FILE', environment));
  const manifestPath = path.resolve(requireEnvironment('BACKUP_MANIFEST_FILE', environment));
  const key = await readEncryptionKey(
    requireEnvironment('BACKUP_ENCRYPTION_KEY_FILE', environment)
  );
  const manifest = JSON.parse((await decryptFileToBuffer(manifestPath, key)).toString('utf8'));
  if (manifest.formatVersion !== 1) throw new Error('Unsupported backup manifest format.');
  if (manifest.encryptedDump?.fileName !== path.basename(backupPath)) {
    throw new Error('Backup dump does not match its encrypted manifest.');
  }
  const encryptedDumpHash = await sha256File(backupPath);
  if (encryptedDumpHash !== manifest.encryptedDump.sha256) {
    throw new Error('Encrypted backup checksum does not match the manifest.');
  }

  const target = parseDatabaseUrl(
    requireEnvironment('RESTORE_TARGET_DATABASE_URL', environment)
  );
  assertSafeRestoreTarget(target, manifest, key, environment);
  const targetSystemIdentifierDigest = databaseIdentityDigest(
    {
      host: 'postgres-system',
      port: '0',
      database: await captureSystemIdentifier(target, environment)
    },
    key
  );
  if (
    manifest.sourceEnvironment === 'production' &&
    targetSystemIdentifierDigest === manifest.sourceSystemIdentifierDigest
  ) {
    throw new Error('Production backup must be restored to a different PostgreSQL cluster.');
  }
  await assertRestoreTargetMarker(target, environment);
  await assertEmptyRestoreTarget(target, environment);
  await prepareEmptyRestoreTargetSchema(target, environment);

  await restoreEncryptedDump(backupPath, key, target, environment);

  const actualSnapshot = await captureDatabaseSnapshot(target, environment);
  if (!snapshotsMatch(manifest.snapshot, actualSnapshot)) {
    const differences = snapshotDifferenceSections(manifest.snapshot, actualSnapshot);
    throw new Error(
      `Restored database validation failed in: ${differences.join(', ') || 'unknown section'}.`
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      status: 'source_snapshot_verified',
      restoredAt: new Date().toISOString(),
      targetEnvironment: environment.RESTORE_TARGET_ENV,
      tableCount: Object.keys(actualSnapshot.tableCounts).length,
      migrationCount: Number(actualSnapshot.migrations.appliedCount),
      relationViolations: actualSnapshot.relationViolations,
      repositorySchemaDriftCheckRequired: true
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`Restore failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
