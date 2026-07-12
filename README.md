# sales-ai-system

CAMPFIREなどのプロジェクトURLをもとに、営業先分析、営業切り口整理、営業メール下書き生成を行うAI営業支援システムです。

## 目的

- 営業メール作成に必要な情報収集と整理を効率化する
- 商品特徴、ブランド情報、過去プロジェクト情報をもとに営業切り口を作る
- 送信前に人が確認・編集できる営業メール下書きを生成する

## 初期構成

- `docs/`: 仕様、設計、運用、Codex向け指示
- `openapi/`: REST API仕様
- `prisma/`: Prisma schema
- `apps/api/`: NestJS API
- `prompts/`: AI分析・メール生成用プロンプト
- `schemas/`: JSON Schema、型定義、入出力仕様
- `scraper/`: スクレイピング関連
- `packages/`: 共通ライブラリ
- `database/`: DBスキーマ、マイグレーション、SQL
- `tests/`: テスト
- `scripts/`: 補助スクリプト

## 開発方針

まずはMVPとして、ローカル実行・低コスト・人間確認前提で進めます。

## セットアップ

```bash
npm install
cp .env.example .env
npm run prisma:validate
npm run prisma:generate
npm run build
npm run start
```

## ローカルDB

Dockerが使える場合:

```bash
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
npm run start
```

Dockerを使わない場合は、PostgreSQLを用意して `.env` の `DATABASE_URL` を接続先に変更してください。

DBなしでもアプリ自体は起動できますが、Company / Project / Lead / Mail などDBを使うAPIは接続先DBが必要です。

## ローカル営業画面

API起動後にブラウザで開きます。

```text
http://localhost:3000/
```

この画面で以下を行えます。

- CAMPFIRE URL取り込み
- 営業リスト確認
- AIメール下書き生成
- 生成メール確認・編集
- レビュー依頼、承認、キュー投入
- 送信前チェックリスト確認

## API疎通確認

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/companies
curl http://localhost:3000/api/leads
```

CAMPFIRE URL取り込み:

```bash
curl -X POST http://localhost:3000/api/projects/import/campfire \
  -H "Content-Type: application/json" \
  -d '{"url":"https://camp-fire.jp/projects/935270/view"}'
```

AIメール下書き生成:

```bash
curl -X POST http://localhost:3000/api/ai/leads/{leadId}/email-draft \
  -H "Content-Type: application/json" \
  -d '{"templateKey":"normal","tone":"low_sales_pressure"}'
```

`.env` の `OPENAI_API_KEY` が未設定、またはOpenAI APIの残高がない場合はメール生成は止まります。生成されたメールは下書き保存のみで、自動送信はされません。

## 確認済み動作

2026-07-09 時点で、ローカル環境にて以下を確認済みです。

- `GET /health`
- `GET /api/companies`
- `GET /api/leads`
- `POST /api/mails/draft`
- `POST /api/mails/:id/request-review`
- `POST /api/mails/:id/approve`
- `POST /api/mails/:id/queue`
- 未承認メールの `queue` が `409 Conflict` でブロックされること

未承認queueブロック確認:

```bash
curl -X POST http://localhost:3000/api/mails/{draftMailId}/queue
```

期待結果:

```json
{
  "message": "Only approved mail can be queued.",
  "error": "Conflict",
  "statusCode": 409
}
```

## 実装状況

- Prisma schema validate済み
- 初期migration SQL生成済み
- seedスクリプト追加済み
- NestJS API基盤を追加
- Company / Project / Lead / Mail / AI / Tracking の主要APIを実装開始
- CAMPFIRE URLから Company / CrowdfundingProject / SalesLead を作成するimport APIを追加
- OpenAI APIによるAIメール下書き生成を追加
- 実メール送信はprovider設定時だけ有効。未設定時は安全に拒否し、承認済みメールだけキュー投入可能

## 主要ドキュメント

- `docs/00_CHARTER.md`: 開発憲章、原則、判断基準
- `docs/INDEX.md`: 設計書一覧
- `docs/05_UI.md`: 画面設計
- `docs/06_API.md`: API設計
- `docs/08_DOMAIN.md`: ドメイン設計
- `docs/15_CODEX.md`: Codex実装仕様
- `docs/18_AI_MAINTAINABLE_ARCHITECTURE.md`: AIが修正しやすい実装アーキテクチャ
- `docs/19_LOW_MODEL_HANDOFF.md`: 小さいモデル向けの現在地・制約・残作業
- `AGENTS.md`: AIが変更前に守る短い実装ルール
