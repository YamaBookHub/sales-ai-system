# 11_TEST

## テスト

スクレイピング、AI出力、メール文面、UI、APIのテスト方針を管理します。

## 通常検証

`npm run verify` はOpenAPIと実装経路の一致、Prisma schema、unit test、buildを順に確認する。外部サイト、OpenAI、Gmail、実DBには接続しない。

## 実DB統合テスト

`npm run test:integration` はDocker PostgreSQL内の専用DB `sales_ai_system_test` を作成し、既存migrationを適用してからintegration testを実行する。通常の `sales_ai_system` DBには書き込まない。

```bash
docker compose up -d postgres
npm run test:integration
```

別のPostgreSQLを使う場合は `TEST_DATABASE_URL` を指定する。database名に `test` が含まれないURLは安全のため拒否する。

```bash
TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/sales_ai_system_test' npm run test:integration
```

integration dataは各testが固有suffixを付け、終了時に関連順で削除する。強制終了で残った場合も通常データと衝突しない名前を使用する。seedはintegration testでは実行しない。
