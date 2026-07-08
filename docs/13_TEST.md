# 13_TEST.md - テスト 実装仕様

## 1. 目的
営業AIシステムが二重送信、誤送信、AI出力不正、DB不整合を起こさないことを検証する。

## 2. テスト階層
| 階層 | 対象 | ツール |
|---|---|---|
| Unit | service/usecase/schema | Jest |
| Integration | Prisma/Gmail mock/Queue | Jest + Test DB |
| E2E | API全体 | Supertest |
| Contract | OpenAPI | openapi schema check |
| Migration | Prisma migrate | prisma validate/migrate |

## 3. 必須Unit Test
- LeadScore計算
- priority変換
- メール生成出力Schema検証
- 返信分類Schema検証
- unsubscribe判定
- send-mail冪等性
- retry可否判定
- status遷移制約

## 4. 必須Integration Test
- lead作成→AIメール生成→draft保存
- approved以外のメールが送信されない
- approvedメールがqueueに入りsentになる
- Gmail送信失敗時にretryされる
- invalid recipientはretryされない
- reply同期でEmailReplyが作成される
- click trackingでLinkClickが作成される

## 5. E2Eシナリオ
```text
1. 会社登録
2. クラファン案件登録
3. lead作成
4. score計算
5. AI draft生成
6. 管理者approve
7. queue送信
8. tracking event登録
9. reply分類
10. task作成
```

## 6. テストデータ
`prisma/seed.ts` に以下を作成する。
- admin user
- sample platform
- sample company
- sample project
- sample lead
- sample template

## 7. 受け入れ基準
- `npm test` 成功
- `npm run test:e2e` 成功
- `npx prisma validate` 成功
- `npx prisma migrate dev --name init` 成功
- OpenAPI yaml parse成功
- approved以外の送信不可テスト成功

## 8. 禁止事項
- 実Gmailに送るテストをCIで実行しない
- 本文に実メールアドレスを含めない
- 外部AI APIに依存するUnit Testを書かない

## 9. Codex実装指示
AIとGmailは必ずinterface化し、テストではmock providerを注入する。DBはTestcontainersまたは専用PostgreSQLを使う。SQLite代替は禁止。
