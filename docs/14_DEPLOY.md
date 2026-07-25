# デプロイ・運用仕様

## 1. 現在の構成

- APIはNestJSの `apps/api` を `nest build api` でbuildする。
- DBはPostgreSQL、ORMはPrismaである。
- 現行package scriptsにはAPIのstart、test、Prisma validate/generate/migrate/seed、production migration、Docker buildがある。
- production artifactはmulti-stage `Dockerfile` の `migration` targetと `runtime` targetに分離する。
- `runtime` はPlaywright Chromiumを含み、Prisma CLIや開発依存を含めず、非root userでAPIだけを起動する。
- `migration` はPrisma CLIとmigration SQLだけを持ち、APIを起動しない。
- worker、scheduler、Redis、DLQ、`npm run lint`、`npm run start:worker`、`npm run start:scheduler` は未実装である。デプロイ手順に実装済みのscriptとして記載しない。
- 認証、RBAC・監査、組織分離は `37_AUTHENTICATION_CONTRACT.md`、`38_RBAC_AUDIT_CONTRACT.md`、`39_ORGANIZATION_ISOLATION_CONTRACT.md` に従って実装済みである。

## 2. 環境変数

下表は `.env.example` と同じ変数だけを記載する。必須/任意の条件は実行する機能ごとに分ける。

### アプリ起動に必要

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `DATABASE_URL` | API起動時に必須 | PostgreSQL接続URL |

### 利用者認証で使用

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `APP_ENV` | 必須 | `local` / `test` / `staging` / `production` |
| `AUTH_MODE` | 必須 | localは`local`、testは`test`、staging/productionは`google` |
| `APP_BASE_URL` | 必須 | 公開origin。staging/productionはHTTPS必須 |
| `AUTH_DEV_USER_EMAIL` | local login時に必須 | local seedに存在する固定active user |
| `SESSION_SECRETS` | staging/productionで必須 | session token HMAC secret。32文字以上、rotation時はカンマ区切り |
| `CSRF_SECRET` | staging/productionで必須 | CSRF token HMAC secret。32文字以上 |
| `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` | Google login時に必須 | 利用者ログイン専用。Gmail送信用とは共用しない |
| `GOOGLE_AUTH_REDIRECT_URI` | Google login時に必須 | HTTPS callback URL |
| `GOOGLE_ALLOWED_DOMAINS` | 任意 | 許可するGoogle Workspace domainのカンマ区切り |
| `AUTH_BOOTSTRAP_ADMIN_ENABLED` | 初期admin作成時だけ`true` | 通常は`false` |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_NAME` | 初期admin作成時 | 既存userの再有効化・自動昇格は行わない |

### AI機能で使用

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `AI_DEFAULT_MODEL` | 任意 | 外部AIモデル未指定時の既定値。省略時は互換用 `OPENAI_MODEL`、その次に `gemini-3.1-flash-lite` |
| `GEMINI_API_KEY` | Geminiの整形/整合性確認を使う場合に必須 | Google AI Studioで発行するGemini API key。未設定時はGemini機能がエラーになる |
| `GEMINI_MAX_DESCRIPTION_CHARS` | 任意 | Geminiへ渡す説明の上限。省略時 `1200` |
| `GEMINI_MAX_OUTPUT_TOKENS` | 任意 | Geminiによる整形の出力上限。省略時 `1600` |
| `GEMINI_SEMANTIC_CHECK_MAX_OUTPUT_TOKENS` | 任意 | Geminiによる整合性確認の出力上限。省略時 `600` |
| `GEMINI_FLASH_LITE_INPUT_COST_PER_1M` / `GEMINI_FLASH_LITE_OUTPUT_COST_PER_1M` | 任意 | Flash-Liteの概算コスト記録用単価。既定値は `$0.25` / `$1.50` |
| `GEMINI_FLASH_INPUT_COST_PER_1M` / `GEMINI_FLASH_OUTPUT_COST_PER_1M` | 任意 | Flashの概算コスト記録用単価。既定値は `$1.50` / `$9.00` |
| `OPENAI_API_KEY` | OpenAIの下書き生成/整合性確認を使う場合に必須 | OpenAI API key。未設定時は該当機能がエラーになる |
| `OPENAI_MODEL` | 任意 | OpenAI client単体の省略時は `gpt-5.6-luna`。画面で選択したGPT-4.1 mini/LUNA/SOLはリクエスト単位でこの値より優先 |
| `OPENAI_MAX_DESCRIPTION_CHARS` | 任意 | 下書き生成へ渡す説明の上限。省略時 `1200` |
| `OPENAI_MAX_OUTPUT_TOKENS` | 任意 | 下書き生成の出力上限。省略時 `1200` |
| `OPENAI_SEMANTIC_CHECK_MAX_OUTPUT_TOKENS` | 任意 | 整合性確認の出力上限。省略時 `400` |
| `OPENAI_INPUT_COST_PER_1M` | 任意 | token cost記録用の入力単価。未設定時はcostを算出しない |
| `OPENAI_OUTPUT_COST_PER_1M` | 任意 | token cost記録用の出力単価。未設定時はcostを算出しない |

### APIと取得処理で使用

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `PORT` | 任意 | listen port。省略時 `3000` |
| `HOST` | 任意 | listen host。省略時 `127.0.0.1` |
| `CAMPFIRE_PROFILE_LOOKUP_CONCURRENCY` | 任意 | CAMPFIRE profile lookup並列数。省略時 `8` |
| `CAMPFIRE_SEARCH_CACHE_TTL_MS` | 任意 | CAMPFIRE検索cache TTL。省略時 `300000` ms |

### 実送信で使用

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `MAIL_SEND_ENABLED` | 実送信を有効化する場合のみ `true` | `true` で明示しない限り実送信しない |
| `MAIL_SENDER_PROVIDER` | 実送信を有効化する場合に指定 | 現行対応値は `disabled` または `gmail` |
| `MAIL_PROVIDER` | 任意 | `MAIL_SENDER_PROVIDER` が未設定の場合の互換fallback。通常は使わない |
| `GMAIL_CLIENT_ID` | providerが `gmail` の場合に必須 | Gmail OAuth client ID |
| `GMAIL_CLIENT_SECRET` | providerが `gmail` の場合に必須 | Gmail OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | providerが `gmail` の場合に必須 | 送信用Gmail OAuth refresh token |
| `GMAIL_FROM_EMAIL` | providerが `gmail` の場合に必須 | 送信元メールアドレス |

初期値は `MAIL_SEND_ENABLED=false`、`MAIL_SENDER_PROVIDER=disabled` とする。実送信は `queued`、承認済み、checklist完了のメールだけが対象で、AI生成直後の自動送信は行わない。`site_message` と `contact_form` の外部送信providerはない。

### テスト専用

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `TEST_DATABASE_URL` | 実DB integration testを実行する場合のみ必須 | integration testが使用するPostgreSQL URL。通常のbuild/testには不要 |

### バックアップ・復元

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `BACKUP_OUTPUT_DIR` | backup/prune時に必須 | リポジトリ外の `0700` directory。productionはoff-host object storageへ同期するmount |
| `BACKUP_ENCRYPTION_KEY_FILE` | backup/restore/prune時に必須 | 32 byteの鍵を保存した `0600` file |
| `BACKUP_KEY_ID` | backup時に必須 | 鍵世代を識別する非秘密ID |
| `BACKUP_STORAGE_LABEL` | production backup・全prune時に必須 | 保存先prefixを示す非秘密label。local値はproduction backupで拒否し、pruneでは異なるlabelを拒否 |
| `BACKUP_RETENTION_DAYS` | 任意 | 日次backup保持日数。省略時35 |
| `BACKUP_MINIMUM_COUNT` | 任意 | 期限超過でも残す最低世代数。省略時7 |
| `BACKUP_PRUNE_CONFIRM` | 実削除時だけ | dry-runが返す1回限りの `DELETE_<plan-hash>`。対象が変わると無効になる |
| `BACKUP_FILE` / `BACKUP_MANIFEST_FILE` | restore時に必須 | 対になる暗号化dump・manifest |
| `RESTORE_TARGET_DATABASE_URL` | restore時に必須 | productionと別clusterにある空のstaging/test/restore DB |
| `RESTORE_TARGET_ENV` | restore時に必須 | `staging` / `test` / `restore` |
| `RESTORE_CONFIRM` | restore時に必須 | `RESTORE_TO_<database-name>` の完全一致 |
| `DB_OPS_MODE` | 任意 | `native` またはlocal用 `docker-compose`。既定はnative |
| `DB_OPS_DOCKER_SERVICE` / `DB_OPS_DOCKER_HOST` | Compose利用時のみ | PostgreSQL clientを実行するserviceとcontainer内host |
| `RELEASE_REVISION` | 推奨 | 暗号化manifestへ格納するGit revision |

RPOは24時間、RTOは4時間、日次backupは35日、migration直前backupは別prefixで90日保持する。詳細と実行例は `docs/40_BACKUP_RESTORE_RUNBOOK.md` を正とする。

## 3. 実行手順

### ローカル確認

```bash
npm ci
npm run prisma:validate
npm test -- --runInBand
npm run build
```

### DB操作

開発DBへのmigration適用は次を使う。

```bash
npm run prisma:migrate
npm run prisma:generate
```

初期adminが必要な環境ではmigration後に一度だけ実行し、完了後にflagを無効化する。

```bash
AUTH_BOOTSTRAP_ADMIN_ENABLED=true npm run auth:bootstrap-admin
```

seedを明示的に実行する場合は `npm run prisma:seed` を使う。staging/productionでは開発用の `prisma migrate dev` を使わず、次だけを使う。

```bash
npm run prisma:migrate:deploy
npm run prisma:migrate:status
```

### production artifact

同じGit revisionからmigration用とAPI用の2つをbuildする。build時に `.env` やcredentialを渡さない。

```bash
npm run docker:build:migration
npm run docker:build
npm run docker:build:database-ops
```

release時は必ずmigrationを先に一度実行する。`/secure/path/production.env` はリポジトリ外で管理し、少なくとも `DATABASE_URL` を含める。

```bash
docker run --rm \
  --env-file /secure/path/production.env \
  sales-ai-system-migration:local

docker run -d \
  --name sales-ai-system \
  --env-file /secure/path/production.env \
  --ipc=host \
  -p 3000:3000 \
  sales-ai-system:local
```

`runtime` imageは起動時にmigrationを自動適用しない。migration失敗時はAPIを新revisionへ切り替えず、DB backupとmigration SQLを確認する。migration成功後にAPI起動が失敗した場合は、schema互換性を確認したうえで直前のAPI imageへ戻す。

`database-ops` targetはPostgreSQL 16 clientとdependency-freeのbackup/restore scriptだけを持つ。API process、Prisma Client、AI/Gmail credentialは含めない。日次backup、保持削除、隔離staging復元にだけ使う。

Dockerの `HEALTHCHECK` と `/health` はAPI processのliveness確認であり、DB readinessやmigration完了を保証しない。traffic切替前のreadinessは `migration` image成功、`npm run prisma:migrate:status` 成功、API health成功の3点で判定する。

Playwright Chromiumの安定動作には十分な共有メモリが必要なため、上の例では `--ipc=host` を使う。外部URLを取得するproduction環境では、実行基盤に合わせてPlaywright公式の推奨seccomp profileも適用し、Chromium sandboxを無効化しない。

### integration test

Docker PostgreSQLを起動後、専用DB `sales_ai_system_test` にmigrationを適用して実行する。通常の開発DBは使わない。

```bash
docker compose up -d postgres
npm run test:integration
```

別DBを指定する場合は `TEST_DATABASE_URL` を使う。database名に `test` が含まれないURLはrunnerが拒否する。

## 4. デプロイ前の安全確認

- `npm run verify` が成功する。
- 空のPostgreSQLへ `npm run prisma:migrate:deploy` を実行し、続く `npm run prisma:migrate:status` が未適用なしで成功する。
- `migration` と `runtime` のDocker buildが成功する。
- migration差分を確認し、本番データに対する破壊的変更を行わない。
- 最新の日次backup成功と、過去1か月以内の隔離staging復元演習成功を確認する。
- `MAIL_SEND_ENABLED` は明示的に必要な環境だけ `true` にする。
- Gmailの実送信を有効化する前に、承認、checklist、送信対象、配信停止、blockの運用確認を行う。
- Gemini/OpenAI API key、Gmail secret、refresh tokenをリポジトリへ保存しない。
- 実Gemini、実OpenAI、実Gmail、外部サイトへの書き込みは、明示的な運用手順とテスト対象を定めてから行う。

## 5. CI

`.github/workflows/verify.yml` はPull Requestとmain pushで次を行う。

1. browserをdownloadせず `npm ci`
2. OpenAPI、artifact契約、Prisma schema、unit test、Nest buildを `npm run verify` で確認
3. `migration` targetをbuildし、そのimageからCI専用の空PostgreSQLへ全migrationを適用
4. 未適用migrationと `schema.prisma` からのdriftがないことを確認
5. `runtime` targetをbuild
6. `database-ops` targetをbuild

`.github/workflows/backup-restore-drill.yml` は毎月と手動実行で、合成データを暗号化backupし別の空DBへ復元する。全table件数、主要relation、migration status、schema driftを検証する。CIにproduction DB、実backup、実暗号鍵を渡さない。

CIはsecretを必要とせず、image registryへのpushやstaging/production deployを行わない。

## 6. 未実装の運用基盤

- Redisを使う共有queue/worker/scheduler/DLQ
- 監視、alert webhook
- Gmail providerの外部API retryと真の冪等送信

利用者認証credentialとGmail送信用OAuth credentialは共用しない。
