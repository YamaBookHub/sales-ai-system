# バックアップ・復元運用手順

## 1. 目的と目標

PostgreSQLと復旧に必要な非秘密設定を、誤操作や漏えいを防ぎながら復元できる状態にする。

- RPO目標: 24時間以内
- RTO目標: 4時間以内
- 日次バックアップ: 35日保持、最低7世代
- migration直前バックアップ: 90日保持。日次とは別の保存prefixを使う
- 合成データの自動復元演習: 毎月1日
- 最新の実バックアップを使う隔離staging復元演習: 毎月1回
- 復元演習記録: 1年間保持

24時間未満のRPOが必要になった時は、論理dumpだけで対応せず、管理DBのPITRまたはWAL archiveを追加する。

## 2. 保存と暗号鍵

- dumpはPostgreSQL 16のcustom formatで作り、アプリケーション正本である `public` schemaだけを対象にする。
- dumpは平文ファイルへ保存せず、Node.jsのAES-256-GCMで認証付き暗号化する。
- manifestも暗号化する。DB URL、password、host、会社名、メール本文を平文のsidecarへ出さない。
- `BACKUP_OUTPUT_DIR` はリポジトリ外のprivate directoryとし、権限は `0700` にする。
- `BACKUP_ENCRYPTION_KEY_FILE` は32 byteの鍵を格納した `0600` fileとする。
- productionの出力先は、別account/projectの非公開・versioning・object lock付きobject storageへ同期されるmountを使う。ローカルディスクだけの保存は禁止する。
- 鍵はsecret managerで世代管理し、最長バックアップ保持期間より長く保持する。
- backupごとの `BACKUP_KEY_ID` から使用鍵を判別できるようにする。鍵本体はbackupと同じ場所へ置かない。
- `.env` やsecret値はDB backupへ含めない。manifestには許可された非秘密設定とrelease revisionだけを格納する。
- `DATABASE_URL` の `sslmode`、CA・client証明書、接続timeoutなどはlibpq環境変数へ引き継ぐ。productionでは `sslmode=verify-full` と管理済みCAを使用する。

推奨するproduction storage labelは `operations-object-storage-production`。実際のbucket pathは運用accountのsecret管理台帳で管理する。

## 3. 日次バックアップ

database operations imageを同じGit revisionから作る。

```bash
npm run docker:build:database-ops
```

`/secure/path/backup.env` はリポジトリ外に置き、`DATABASE_URL`、`APP_ENV=production`、`MAIL_SEND_ENABLED=false` を含める。出力mountと鍵fileは同じhost上でも別の権限境界に置く。

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env-file /secure/path/backup.env \
  --env DB_OPS_MODE=native \
  --env BACKUP_OUTPUT_DIR=/backup \
  --env BACKUP_ENCRYPTION_KEY_FILE=/run/secrets/backup.key \
  --env BACKUP_KEY_ID=key-2026-01 \
  --env BACKUP_STORAGE_LABEL=operations-object-storage-production \
  --env RELEASE_REVISION="$(git rev-parse HEAD)" \
  --mount type=bind,src=/secure/backups/sales-ai-system,dst=/backup \
  --mount type=bind,src=/secure/keys/sales-ai-backup.key,dst=/run/secrets/backup.key,readonly \
  sales-ai-system-database-ops:local
```

成功時は暗号化dumpと暗号化manifestの2 fileを作る。manifestには全Prisma modelの件数、migration一覧、主要relation検証、column・constraint・index・enum定義、暗号文SHA-256を含む。件数確認とdumpは同じPostgreSQL exported snapshotを使うため、稼働中の更新で検証時点がずれない。失敗時は不完全な出力を削除し、成功扱いにしない。

productionでRPO 24時間を保証するには、このCLIとは別に運用基盤の日次scheduler、off-host storageへの転送、24時間成功がない場合の通知が必要である。これらが設定されるまではRPOは目標であり、達成済みとは扱わない。

ローカルで既存のCompose PostgreSQLを対象にする時だけ、次の設定を使える。

```bash
DB_OPS_MODE=docker-compose npm run db:backup
```

## 4. 保持期間と削除

削除は常にdry-runから始める。対象prefix以外のfileは扱わず、期限を超えていても最新7世代は残す。

```bash
npm run db:backup:prune
```

dry-runは `BACKUP_STORAGE_LABEL` を必須とし、全保持世代について、暗号化manifest、dumpのSHA-256、AES-GCM認証、作成日時、保存先label、dumpとの対応を検証する。label混在や1世代でも破損があれば削除計画を作らない。検証成功後、現在の削除対象とdump hashだけに結び付く `DELETE_<plan-hash>` を返す。表示された対象を確認してから、その値を同じ環境で明示的に実行する。

```bash
BACKUP_PRUNE_CONFIRM='<dry-runが返したDELETE_plan-hash>' npm run db:backup:prune
```

object storage側のlifecycleも35日とする。ただしmigration直前backupは別prefixで90日保持する。顧客削除後の復元で削除済みデータを復活させないため、顧客削除台帳はDB backupと別に保持し、復元後に再適用する。

## 5. 隔離stagingへの復元

復元先はproductionと別cluster・別credential・別networkにする。復元環境からproduction DBへ到達できるnetwork routeを作らない。復元先DBはoperatorが事前に空で作り、自動作成・自動削除はしない。

次の条件を1つでも満たさない場合、restore scriptは停止する。

- `APP_ENV` がproductionではない
- `RESTORE_TARGET_ENV` がstaging、test、restoreのいずれか
- DB名にstaging、test、restoreを含む
- 復元先がbackup元DBではない
- production backupの場合はPostgreSQL cluster自体もbackup元と異なる
- public tableが0件
- `MAIL_SEND_ENABLED=false` を明示
- `RESTORE_CONFIRM=RESTORE_TO_<database-name>` が完全一致
- 復元先DBのcommentが `sales-ai-system:restore-only` と完全一致
- 暗号文SHA-256とAES-GCM認証が成功

復元環境へGmail、OpenAI、Gemini credentialを渡さず、外部送信と外部取得のegressを遮断する。

復元用DBを作る運用担当者は、空DBの作成直後に次を実行する。通常DBにはこのmarkerを付けない。

```sql
COMMENT ON DATABASE sales_ai_system_restore_staging IS 'sales-ai-system:restore-only';
```

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env-file /secure/path/restore.env \
  --env DB_OPS_MODE=native \
  --env APP_ENV=staging \
  --env RESTORE_TARGET_ENV=staging \
  --env MAIL_SEND_ENABLED=false \
  --env RESTORE_CONFIRM=RESTORE_TO_sales_ai_system_restore_staging \
  --env BACKUP_FILE=/backup/<backup>.dump.enc \
  --env BACKUP_MANIFEST_FILE=/backup/<backup>.manifest.enc \
  --env BACKUP_ENCRYPTION_KEY_FILE=/run/secrets/backup.key \
  --mount type=bind,src=/secure/backups/sales-ai-system,dst=/backup,readonly \
  --mount type=bind,src=/secure/keys/sales-ai-backup.key,dst=/run/secrets/backup.key,readonly \
  sales-ai-system-database-ops:local scripts/database/restore.js
```

restore scriptはmarkerと空DBを確認した後、空の `public` schemaを `CASCADE` なしで削除する。objectがあれば削除は失敗し、復元を開始しない。その後、最初の復号passでAES-GCM認証を完了し、2回目の復号streamを `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges` へ直接渡す。平文dump fileは作らない。`--clean`、`--create`、`CASCADE`、汎用 `--force` は使わない。

## 6. 合格確認

restore scriptがsource backupとの一致を自動確認する。

- 全26 application tableのsource/target件数一致
- `_prisma_migrations` の適用済み件数・名称一致
- 未完了migration 0
- public table・index・constraint数一致
- column・constraint・index・enum定義一致
- unvalidated constraint 0
- Membership→User、Lead→Company/Project、Mail→Company/Lead、Opportunity→Leadのorphan 0

restore scriptの `source_snapshot_verified` はsourceとの一致を示す。公開可能な復元成功と判定する前に、続けて同じrevisionのmigration artifactでrepository schemaとの差分も確認する。

```bash
DATABASE_URL='<restore target>' npm run prisma:migrate:status
DATABASE_URL='<restore target>' npx --no-install prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

復元日時、対象backup ID、release revision、経過時間、件数、migration数、relation違反数、担当者、結果を運用台帳へ記録する。RPO 24時間とRTO 4時間を超えた場合は演習失敗とする。

## 7. 定期演習

`.github/workflows/backup-restore-drill.yml` は毎月、secretを使わない合成データで次を確認する。

1. 空DBへ全migration適用
2. relationを持つfixture作成
3. 認証付き暗号化backup
4. 別の空DBへrestore
5. 件数・relation・migration・schema drift検証

これはツールの故障検知であり、実データbackupの回復可能性を保証しない。運用担当者は別clusterの隔離stagingで、最新の実backupを毎月復元する。

## 8. 2026-07-25 初回演習証跡

- source: `sales_ai_system_backup_source_test`
- target: `sales_ai_system_restore_test`
- PostgreSQL: 16
- application table: 26、全件数一致
- migration: 16、未完了0
- column定義: 349、全一致
- constraint定義: 88、全一致
- index定義: 138、全一致
- enum定義: 107、全一致
- 主要relation違反: 0
- unvalidated constraint: 0
- Prisma migration status: up to date
- schema drift: 0
- host scriptと `database-ops` imageの両方からbackup・stream restore成功
- restore専用markerなし、既存tableあり、同一source、production環境は開始前に拒否
- production、外部AI、実送信、ブラウザ、port 3000: 未使用

通常の開発DBが最新schemaではない場合、backupは存在しないtableを検知して停止することも確認した。
