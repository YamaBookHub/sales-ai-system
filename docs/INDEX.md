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
| 17 | 17_IMPLEMENTATION_ROADMAP.md | 実装ロードマップ | 作成済み |
| 18 | 18_AI_MAINTAINABLE_ARCHITECTURE.md | AIが修正しやすい実装アーキテクチャ | 作成済み |
| 19 | 19_LOW_MODEL_HANDOFF.md | 小さいモデル向けの現在地・制約・残作業 | 作成済み |
| 20 | 20_UIUX_AI_IMPLEMENTATION_GUIDE.md | 小さいモデルでも最終形まで進めるUI/UX実装指示書 | 作成済み |
| 21 | 21_UIUX_IMPLEMENTATION_STATUS.md | UI/UXタスクの依存関係・進捗・証跡 | 作成済み |
| 22 | 22_AI_MODEL_ROUTING.md | 作業リスクに応じたモデル選択・自動昇格・委譲ルール | 作成済み |
| 23 | 23_UIUX_MODEL_ROUTING_POLICY.md | UI/UX改善専用のモデル選択・切り替え・監査方針 | 作成済み |
| 24 | 24_SALES_LIST_DATA_MAPPING.md | 営業案件一覧・今日の営業で再利用するdata対応表 | 作成済み |
| 25 | 25_REPLY_INBOX_API_DESIGN.md | 返信一覧APIの現状監査・DTO・filter・pagination設計 | 作成済み |
| 26 | 26_NEXT_ACTION_DESIGN.md | 次回対応のTask利用、状態遷移、API、DB差分設計 | 作成済み |

## 付属仕様
- `../prisma/schema.prisma`
- `../openapi/openapi.yaml`
- `../COMPLETENESS_REPORT.md`

## 次アクション
1. Phase 1のローカル営業画面を完成させる
2. 送信前チェックリストをDB化する
3. 連絡先管理とSNS/ブランド分析を追加する
4. 候補探索、RAG、送信後管理へ進む
