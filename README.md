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

## 実装状況

- Prisma schema validate済み
- NestJS API基盤を追加
- Company / Project / Lead / Mail / AI / Tracking の主要APIを実装開始
- メール送信は未実装。承認済みメールだけキュー投入可能

## 主要ドキュメント

- `docs/00_CHARTER.md`: 開発憲章、原則、判断基準
- `docs/INDEX.md`: 設計書一覧
- `docs/05_UI.md`: 画面設計
- `docs/06_API.md`: API設計
- `docs/08_DOMAIN.md`: ドメイン設計
- `docs/15_CODEX.md`: Codex実装仕様
