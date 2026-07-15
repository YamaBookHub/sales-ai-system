# 28_REMAINING_WORK_STATUS

## 使い方

- `pending`: 未着手
- `in_progress`: 作業中、検証未完了、またはhandoff待ち
- `complete`: Task cardの合格条件と検証をすべて満たした
- `deferred`: ユーザー判断で後回し

上から順に、依存がすべてcompleteのpendingタスクを1件だけ選ぶ。

Baseline:

- Snapshot date: 2026-07-15
- HEAD: `6a04a5a`
- Unit/contract tests: 59 suites / 166 tests passed
- Build: passed
- Prisma validate: passed
- Integration: 1 suite skipped because `TEST_DATABASE_URL` was not set
- Browser: not run in this audit

## Active roadmap

| Order | Task | Priority | Status | Model | Depends on | Evidence | Note |
|---:|---|---|---|---|---|---|---|
| 1 | LR-001 | P0 | complete | Luna T1 | - | 2026-07-15 / 65 operations一致・59 suites・166 tests・build成功 | API/OpenAPI同期 |
| 2 | LR-002 | P0 | complete | Luna T1 | LR-001 | 2026-07-15 / 11 enums・18 models・環境変数同期、Prisma validate・build成功 | DB・安全仕様同期 |
| 3 | LR-003 | P0 | complete | Luna T2 | LR-001, LR-002 | 2026-07-15 / `npm run verify` 成功・CI追加 | baseline verify |
| 4 | LR-004 | P0 | complete | Luna T2 | LR-003 | 2026-07-15 / 専用DB migration・1 suite/1 test成功・誤DB拒否確認 | 実DB integration |
| 5 | LM-001 | P0 | pending | Terra T3 | LR-004 | - | legacy TODO下書き廃止 |
| 6 | LM-002 | P0 | pending | Luna T2 | LM-001 | - | mail golden dataset |
| 7 | LM-003 | P0 | pending | Terra T3 + Sol audit | LM-002 | - | 案件間混入防止 |
| 8 | LS-001 | P0 | pending | Terra T3 | LR-004 | - | parser境界設計 |
| 9 | LS-002 | P0 | pending | Luna T2 | LS-001 | - | Makuake fixture |
| 10 | LS-003 | P0 | pending | Luna T2 | LS-001 | - | CAMPFIRE fixture |
| 11 | LS-004 | P0 | pending | Terra T3 | LS-002, LS-003 | - | 検索終了理由 |
| 12 | LS-005 | P0 | pending | Terra T3 + Sol audit | LS-004 | - | 即時停止 |
| 13 | LS-007 | P0 | pending | Terra T3 | LR-004 | - | 並列取り込み排他 |
| 14 | LS-006 | P1 | pending | Terra T3 | LS-005 | - | 逐次候補追加 |
| 15 | LL-001 | P1 | pending | Terra T3 | LR-001, LR-004 | - | server pagination/filter |
| 16 | LL-002 | P1 | pending | Luna T2 | LL-001 | - | 全件CSV/TSV |
| 17 | LL-003 | P1 | pending | Terra T3 | LL-001 | - | 詳細編集契約 |
| 18 | LM-004 | P1 | pending | Sol T4 -> Terra | LM-003, LL-003 | - | 構造化分析値 |
| 19 | LM-005 | P1 | pending | Terra T3 | LM-003 | - | OpenAI予算guard |
| 20 | LL-004 | P1 | pending | Terra T3 + Sol audit | LL-003 | - | Contact CRUD |
| 21 | LA-001 | P1 | deferred | Sol T4 | LL-004 | - | 本番送信を再優先化するまで後回し |
| 22 | LA-002 | P1 | pending | Sol T4 | LR-002 | - | 認証設計 |
| 23 | LA-003 | P1 | pending | Terra T3 + Sol audit | LA-002 | - | 認証実装 |
| 24 | LA-004 | P1 | pending | Sol T4 | LA-003 | - | RBAC・監査 |
| 25 | LA-005 | P1 | pending | Sol T4 -> Terra | LA-003, LS-006 | - | job所有者・永続化 |
| 26 | LO-001 | P2 | pending | Terra T3 | LA-003 | - | 構造化ログ |
| 27 | LO-002 | P2 | pending | Terra T3 | LR-003, LA-004 | - | CI・本番artifact |
| 28 | LO-003 | P2 | pending | Terra T3 | LM-005, LO-001 | - | 監視・費用表示 |

## Deferred backlog

| Task | Status | Reason |
|---|---|---|
| LB-001 Gmail返信自動同期 | deferred | 送信後対応は後回し |
| LB-002 参考メールRAG | deferred | P0/P1品質安定後 |
| LB-003 GREEN FUNDING | deferred | 現行2provider安定後 |
| LB-004 HP/SNS/連絡先自動探索 | deferred | 認証・監査後 |
| LB-005 site message/contact form送信 | deferred | 外部送信は後回し |
| LB-006 Queue/Worker/DLQ | deferred | 本番送信を再優先化した時 |
| LB-007 商談以降CRM | deferred | ローカルMVP運用評価後 |
| LB-008 Calendar/通知/ポモドーロ | deferred | Google OAuth・user identity後 |

## Execution log

| Date | Task | Model | Event | Result |
|---|---|---|---|---|
| 2026-07-13 | ROADMAP-AUDIT | GPT-5 + GPT-5.6 Luna explorer | audit | 現状、矛盾、残作業、baselineを固定 |
| 2026-07-15 | LR-001 | GPT-5.6 Luna | start | 現行controller routeとAPI/OpenAPIを同期開始 |
| 2026-07-15 | LR-001 | GPT-5.6 Luna + main audit | complete | controllerとmain直登録/OpenAPI 65 operations一致、missing 0・extra 0、OpenAPI parse・test・build成功 |
| 2026-07-15 | LR-002 | GPT-5.6 Luna | start | Prisma schema、security/deploy文書、環境変数の同期開始 |
| 2026-07-15 | LR-002 | GPT-5.6 Luna + main audit | complete | 11 enums・18 models、実環境変数、実package scriptsを同期。Prisma validate・build・diff check成功 |
| 2026-07-15 | LR-003 | main | start | OpenAPI・Prisma・test・buildをまとめるverify script実装開始 |
| 2026-07-15 | LR-003 | main | complete | `npm run verify` で58 paths・65 operations、Prisma、59 suites・166 tests、build成功。GitHub Actions追加 |
| 2026-07-15 | LR-004 | main + Luna explorer | start | integration spec、test DB、migration適用手順の調査開始 |
| 2026-07-15 | LR-004 | main + Luna explorer | complete | `sales_ai_system_test`へ6 migrations適用、1 suite・1 test成功。非test DBは実行前に拒否 |
