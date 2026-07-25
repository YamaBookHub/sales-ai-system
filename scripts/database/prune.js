#!/usr/bin/env node

const fsp = require('node:fs/promises');
const path = require('node:path');
const {
  authenticateEncryptedFile,
  buildPruneConfirmationToken,
  DEFAULT_MINIMUM_BACKUPS,
  DEFAULT_RETENTION_DAYS,
  decryptFileToBuffer,
  ensurePrivateDirectory,
  listBackupSets,
  parsePositiveInteger,
  readEncryptionKey,
  requireEnvironment,
  selectExpiredBackupSets,
  sha256File
} = require('./backup-lib');

async function main(environment = process.env) {
  const outputDirectory = await ensurePrivateDirectory(
    requireEnvironment('BACKUP_OUTPUT_DIR', environment)
  );
  const key = await readEncryptionKey(
    requireEnvironment('BACKUP_ENCRYPTION_KEY_FILE', environment)
  );
  const storageLabel = requireEnvironment('BACKUP_STORAGE_LABEL', environment);
  const retentionDays = parsePositiveInteger(
    environment.BACKUP_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
    'BACKUP_RETENTION_DAYS'
  );
  const minimumBackups = parsePositiveInteger(
    environment.BACKUP_MINIMUM_COUNT,
    DEFAULT_MINIMUM_BACKUPS,
    'BACKUP_MINIMUM_COUNT'
  );
  const directoryEntries = await fsp.readdir(outputDirectory, { withFileTypes: true });
  const entries = await Promise.all(
    directoryEntries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(outputDirectory, entry.name);
        const stat = await fsp.stat(filePath);
        return { name: entry.name, path: filePath, modifiedAt: stat.mtimeMs };
      })
  );
  const backupSets = await Promise.all(
    listBackupSets(entries).map(async (set) => {
      const manifest = JSON.parse(
        (await decryptFileToBuffer(set.manifestPath, key)).toString('utf8')
      );
      if (
        manifest.formatVersion !== 1 ||
        manifest.encryptedDump?.fileName !== path.basename(set.dumpPath) ||
        typeof manifest.createdAt !== 'string' ||
        typeof manifest.storageLabel !== 'string'
      ) {
        throw new Error(`Backup manifest is invalid for ${set.base}.`);
      }
      const dumpSha256 = await sha256File(set.dumpPath);
      if (dumpSha256 !== manifest.encryptedDump.sha256) {
        throw new Error(`Backup dump checksum does not match for ${set.base}.`);
      }
      await authenticateEncryptedFile(set.dumpPath, key);
      const createdAtMs = Date.parse(manifest.createdAt);
      if (!Number.isFinite(createdAtMs)) {
        throw new Error(`Backup manifest has an invalid createdAt for ${set.base}.`);
      }
      if (manifest.storageLabel !== storageLabel) {
        throw new Error(`Backup storage label does not match for ${set.base}.`);
      }
      return {
        ...set,
        createdAt: manifest.createdAt,
        createdAtMs,
        storageLabel: manifest.storageLabel,
        dumpSha256
      };
    })
  );
  backupSets.sort((left, right) => right.createdAtMs - left.createdAtMs);
  const expired = selectExpiredBackupSets(
    backupSets,
    Date.now(),
    retentionDays,
    minimumBackups
  );
  const confirmationToken = buildPruneConfirmationToken(expired, key, outputDirectory);
  const suppliedConfirmation = environment.BACKUP_PRUNE_CONFIRM?.trim();
  if (suppliedConfirmation && suppliedConfirmation !== confirmationToken) {
    throw new Error('BACKUP_PRUNE_CONFIRM does not match the current authenticated prune plan.');
  }
  const apply = Boolean(suppliedConfirmation);

  if (apply) {
    for (const set of expired) {
      await Promise.all([
        fsp.rm(set.dumpPath, { force: true }),
        fsp.rm(set.manifestPath, { force: true })
      ]);
    }
  }
  process.stdout.write(
    `${JSON.stringify({
      status: apply ? 'deleted' : 'dry-run',
      retentionDays,
      minimumBackups,
      availableBackups: backupSets.length,
      expiredBackups: expired.map((set) => set.base),
      confirmationToken: apply || expired.length === 0 ? null : confirmationToken
    })}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`Backup pruning failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
