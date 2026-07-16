# デプロイ・運用仕様

## 1. 現在の構成

- APIはNestJSの `apps/api` を `nest build api` でbuildする。
- DBはPostgreSQL、ORMはPrismaである。
- 現行package scriptsにはAPIのstart、test、Prisma validate/generate/migrate/seedがある。
- worker、scheduler、Redis、DLQ、production用Dockerfile、`npm run lint`、`npm run start:worker`、`npm run start:scheduler` は未実装である。デプロイ手順に実装済みのscriptとして記載しない。

## 2. 環境変数

下表は `.env.example` と同じ変数だけを記載する。必須/任意の条件は実行する機能ごとに分ける。

### アプリ起動に必要

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `DATABASE_URL` | API起動時に必須 | PostgreSQL接続URL |

### AI機能で使用

| 変数 | 必須条件 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAIの下書き生成/整合性確認を使う場合に必須 | OpenAI API key。未設定時は該当機能がエラーになる |
| `OPENAI_MODEL` | 任意 | 省略時 `gpt-5.6-luna`。高品質生成には `gpt-5.6-sol` または `gpt-5.6` を指定。メール画面で選択したLUNA/SOLはリクエスト単位でこの値より優先 |
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

seedを明示的に実行する場合は `npm run prisma:seed` を使う。production向け `prisma migrate deploy` 専用scriptはまだないため、production手順は運用環境でmigration適用方法を確定してから追加する。

### integration test

Docker PostgreSQLを起動後、専用DB `sales_ai_system_test` にmigrationを適用して実行する。通常の開発DBは使わない。

```bash
docker compose up -d postgres
npm run test:integration
```

別DBを指定する場合は `TEST_DATABASE_URL` を使う。database名に `test` が含まれないURLはrunnerが拒否する。

## 4. デプロイ前の安全確認

- `npm run prisma:validate` と `npm run build` が成功する。
- migration差分を確認し、本番データに対する破壊的変更を行わない。
- `MAIL_SEND_ENABLED` は明示的に必要な環境だけ `true` にする。
- Gmailの実送信を有効化する前に、承認、checklist、送信対象、配信停止、blockの運用確認を行う。現行コードではblock/配信停止をclaim前に共通拒否するguardが未実装である。
- OpenAI API key、Gmail secret、refresh tokenをリポジトリへ保存しない。
- 実OpenAI、実Gmail、外部サイトへの書き込みは、明示的な運用手順とテスト対象を定めてから行う。

## 5. 未実装の運用基盤

- Redisを使う共有queue/worker/scheduler/DLQ
- 複数instance間のjob所有者、TTL、cancel、再起動後復旧
- production用Dockerfile、CI verify script、監視、alert webhook
- 認証、JWT/session、GoogleユーザーOAuth、RBAC
- Gmail providerの外部API retryと真の冪等送信

これらは将来要件であり、現行APIのデプロイ手順に存在するものとして扱わない。
