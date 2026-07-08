# 03_INFRA.md

## インフラ実装仕様

## 1. 結論
localはDocker ComposeでPostgreSQLとRedisを起動する。本番はAPI、Web、Workerを分離可能にする。

## 2. 必須環境変数
```env
DATABASE_URL=postgresql://user:password@localhost:5432/sales_ai
REDIS_URL=redis://localhost:6379
API_BASE_URL=http://localhost:3001
WEB_BASE_URL=http://localhost:3000
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
OPENAI_API_KEY=
MAIL_SEND_ENABLED=false
TRACKING_SECRET=
JWT_SECRET=
```

## 3. Docker Compose
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: sales_ai
      POSTGRES_USER: sales_ai
      POSTGRES_PASSWORD: sales_ai
    ports: ["5432:5432"]
  redis:
    image: redis:7
    ports: ["6379:6379"]
```

## 4. Migration
- local: `prisma migrate dev`
- staging/production: `prisma migrate deploy`
- productionで `db push` 禁止。

## 5. Worker
APIプロセスから分離し、mail-send、reply-sync、ai-generationを個別起動できるようにする。


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
