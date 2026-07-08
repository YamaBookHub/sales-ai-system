# 15_CODEX.md - Codex 実装指示書

## 1. 目的
Codexが営業AIシステムを実装するための作業順序、禁止事項、完了条件を定義する。

## 2. 最重要ルール
- docsを正本とする
- 仕様不明点は勝手に補完しない
- メール自動送信はapproved必須
- AI生成内容は必ず保存する
- DB変更時はPrisma schemaとmigrationを更新する
- OpenAPIをAPI実装と同期する
- 個人情報をログへ平文出力しない

## 3. 実装順序
### Phase 1: 基盤
1. NestJS API雛形
2. Prisma接続
3. Auth/User
4. AuditLog
5. Company/Contact/Project/Lead CRUD

### Phase 2: DB・API整備
1. `schema.prisma` validate
2. migration作成
3. seed作成
4. OpenAPIとDTO作成
5. Repository/Service分離

### Phase 3: メール
1. Gmail OAuth設定
2. draft作成API
3. review/approve API
4. queue送信
5. event保存
6. reply同期
7. tracking link

### Phase 4: AI
1. AI client wrapper
2. prompt registry
3. Zod schema
4. lead score
5. mail generation
6. reply classification

### Phase 5: 運用
1. Worker
2. Scheduler
3. Monitoring
4. Tests
5. Deploy scripts

## 4. ディレクトリ構成
```text
apps/api/src/
├── auth/
├── users/
├── companies/
├── projects/
├── leads/
├── mail/
├── ai/
├── jobs/
├── tracking/
├── audit/
├── common/
└── main.ts
```

## 5. 完了条件
- `npm run build` 成功
- `npm test` 成功
- `npx prisma validate` 成功
- migration生成済み
- OpenAPI更新済み
- approved以外送信不可
- unsubscribe処理あり
- AI生成ログ保存あり
- READMEに起動手順あり

## 6. 禁止事項
- DBを仕様なしに変更しない
- AI出力をそのまま送信しない
- Gmail実送信をUnit Testで行わない
- メール本文・IP・tokenをログに平文出力しない
- `any` 乱用禁止
- 例外を握りつぶさない

## 7. 最初にCodexへ渡すプロンプト
```text
このリポジトリは営業AIシステムです。docs/ を正本として実装してください。
まず prisma/schema.prisma を検証し、NestJS API、Prisma、PostgreSQL、BullMQ、Gmail API、AI生成機能の順に実装してください。
メール送信は必ず review -> approved -> queued -> sent の状態遷移を守り、AI生成メールを直接送信しないでください。
実装前に docs/INDEX.md と docs/15_CODEX.md を読み、未定義仕様は TODO として明示してください。
```

## 8. レビュー観点
- 状態遷移が仕様通りか
- DB制約が仕様通りか
- APIレスポンスがOpenAPI通りか
- 監査ログが残るか
- 送信停止が守られるか
- retryとDLQがあるか
