# 14_DEPLOY.md - デプロイ 実装仕様

## 1. 目的
営業AIシステムを安全に本番運用できる形でデプロイする。

## 2. 環境
| 環境 | 用途 | DB |
|---|---|---|
| local | 開発 | local PostgreSQL |
| staging | 検証 | staging PostgreSQL |
| production | 本番 | production PostgreSQL |

## 3. 必須環境変数
```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GOOGLE_REFRESH_TOKEN=
OPENAI_API_KEY=
APP_BASE_URL=
TRACKING_BASE_URL=
ALERT_WEBHOOK_URL=
```

## 4. デプロイ前チェック
- `npm ci`
- `npm run lint`
- `npm test`
- `npm run build`
- `npx prisma validate`
- `npx prisma migrate deploy`
- `openapi.yaml` parse確認

## 5. Migration方針
本番では `migrate dev` を使わない。必ずCIで生成済みmigrationを確認し、本番では `prisma migrate deploy` のみ実行する。

## 6. Rollback方針
- DB破壊的変更は禁止
- カラム削除は2段階で行う
- 先にnullable追加、アプリ更新、後日制約追加
- 送信系障害時はqueue workerを停止しAPIは維持

## 7. Worker起動
```bash
npm run start:api
npm run start:worker
npm run start:scheduler
```

## 8. 初回デプロイ手順
1. DB作成
2. Redis作成
3. 環境変数登録
4. Prisma migrate deploy
5. seed実行
6. API起動
7. Worker起動
8. Gmail OAuth疎通確認
9. AI疎通確認
10. テストメールを自社宛に送信

## 9. 本番安全設定
- 送信上限は初期300通/日以下
- 営業メールはapproved必須
- unsubscribe即時反映
- DLQ通知ON
- 監査ログON

## 10. Codex実装指示
Docker Composeでlocal環境を再現できるようにする。API、worker、postgres、redisを含める。production用Dockerfileはmulti-stage buildにする。
