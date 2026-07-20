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

## RBAC・監査契約テスト

LA-004では次を通常testと実DBintegration testの対象にする。

- 15 permissionと4 roleの対応表、およびmetadata未指定のfail-closed。
- viewerの更新拒否、operatorのapprove/queue/send拒否、managerのapprove/queue許可、adminのsend/user/audit許可。
- request body/headerによるactor・role偽装ができないこと。
- 成功した重要操作に認証userIdとsessionIdが付くこと、拒否・失敗時に業務更新や成功監査が残らないこと。
- role変更・利用停止・session一括失効、最後の有効なadmin保護、self-lockout拒否。
- OpenAPI全保護operationの`x-permission`と403応答、`/api/auth/me.permissions`、管理APIのpath/DTO契約。
