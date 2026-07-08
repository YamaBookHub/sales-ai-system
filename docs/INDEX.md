# INDEX.md - 営業AIシステム v1.0 設計書一覧

## 正本
この `docs/` フォルダを設計書の正本とする。

## ドキュメント
| No | File | 内容 | 状態 |
|---:|---|---|---|
| 00 | 00_CHARTER.md | 憲章・目的・原則 | 作成済み |
| 01 | 01_REQUIREMENTS.md | 要件定義 | 作成済み |
| 02 | 02_ARCHITECTURE.md | 全体アーキテクチャ | 作成済み |
| 03 | 03_INFRA.md | インフラ | 作成済み |
| 04 | 04_SECURITY.md | セキュリティ | 作成済み |
| 05 | 05_UI.md | UI仕様 | 作成済み |
| 06 | 06_API.md | API仕様 | 作成済み |
| 07 | 07_DATABASE.md | DB/Prisma/ER/Index | 作成済み |
| 08 | 08_DOMAIN.md | ドメイン設計 | 作成済み |
| 09 | 09_MAIL.md | メール基盤 | 作成済み |
| 10 | 10_AI.md | AI機能 | 補強済み |
| 11 | 11_BATCH.md | バッチ/Queue | 補強済み |
| 12 | 12_MONITORING.md | 監視/ログ | 補強済み |
| 13 | 13_TEST.md | テスト | 補強済み |
| 14 | 14_DEPLOY.md | デプロイ | 補強済み |
| 15 | 15_CODEX.md | Codex実装指示 | 補強済み |
| 16 | 16_GITHUB_HANDOFF.md | GitHub反映手順 | 作成済み |

## 付属仕様
- `../prisma/schema.prisma`
- `../openapi/openapi.yaml`
- `../COMPLETENESS_REPORT.md`

## 次アクション
1. GitHubへ反映
2. `npx prisma validate`
3. `npm run build` / `npm test`
4. Codexに `docs/15_CODEX.md` を起点として実装指示
