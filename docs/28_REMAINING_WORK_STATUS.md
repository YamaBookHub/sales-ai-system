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
- Unit/contract tests: 64 suites / 198 tests passed
- Build: passed
- Prisma validate: passed
- Integration: dedicated `sales_ai_system_test` DBで1 suite / 1 test passed
- Browser: not run in this audit

## Active roadmap

| Order | Task | Priority | Status | Model | Depends on | Evidence | Note |
|---:|---|---|---|---|---|---|---|
| 1 | LR-001 | P0 | complete | Luna T1 | - | 2026-07-15 / 65 operations一致・59 suites・166 tests・build成功 | API/OpenAPI同期 |
| 2 | LR-002 | P0 | complete | Luna T1 | LR-001 | 2026-07-15 / 11 enums・18 models・環境変数同期、Prisma validate・build成功 | DB・安全仕様同期 |
| 3 | LR-003 | P0 | complete | Luna T2 | LR-001, LR-002 | 2026-07-15 / `npm run verify` 成功・CI追加 | baseline verify |
| 4 | LR-004 | P0 | complete | Luna T2 | LR-003 | 2026-07-15 / 専用DB migration・1 suite/1 test成功・誤DB拒否確認 | 実DB integration |
| 5 | LM-001 | P0 | complete | Terra T3 | LR-004 | 2026-07-15 / 60 suites・172 tests・build成功 | legacy TODO下書き廃止 |
| 6 | LM-002 | P0 | complete | Luna T2 | LM-001 | 2026-07-15 / 6案件のgolden dataset追加・現行不具合2件を検出 | mail golden dataset |
| 7 | LM-003 | P0 | complete | Terra T3 + Sol audit | LM-002 | 2026-07-16 / 6案件golden・64 suites・198 tests・integration・build成功 | 案件間混入防止 |
| 8 | LS-001 | P0 | complete | Terra T3 | LR-004 | 2026-07-16 / listing・detail・profile境界とfixture方針を文書化 | parser境界設計 |
| 9 | LS-002 | P0 | complete | Luna T2 | LS-001 | 2026-07-16 / listing・detail・profile fixture 6 tests、全69 suites・220 tests成功 | Makuake fixture |
| 10 | LS-003 | P0 | complete | Luna T2 | LS-001 | 2026-07-16 / generic project linkを含むfixture 7 tests、既存scraper 2 tests成功 | CAMPFIRE fixture |
| 11 | LS-004 | P0 | complete | Terra T3 | LS-002, LS-003 | 2026-07-16 / 6終了理由・両provider診断・71 suites・233 tests・build成功 | 検索終了理由 |
| 12 | LS-005 | P0 | complete | Terra T3 + Sol audit | LS-004 | 2026-07-16 / AbortSignal伝播・context-first close・74 suites・240 tests・build成功 | 即時停止 |
| 13 | LS-007 | P0 | complete | Terra T3 | LR-004 | 2026-07-16 / advisory lock・実DB並列4 tests成功 | 並列取り込み排他 |
| 14 | LL-003 | P0 | complete | Terra T3 + read-only audit | LR-004 | 2026-07-17 / 3モデル一括更新・null消去・手入力保護・77 suites 252 tests・integration 5 tests成功 | 詳細編集契約 |
| 15 | LL-004 | P0 | complete | Terra T3 + Sol audit | LL-003 | 2026-07-17 / 複数連絡先・primary排他・配信停止・メール安全境界、84 suites 287 tests・実DB6 tests成功 | Contact CRUD |
| 16 | SO-001 | P0 | complete | Luna T2 | LM-001 | 2026-07-16 / mark-sent API・sent event・UI実装済み | 手動送信記録 |
| 17 | SO-002 | P0 | complete | Terra T3 + Luna audit | SO-001, LL-004 | 2026-07-18 / 8分類・原子更新・重複防止・今日ページング、86 suites 297 tests・実DB8 tests成功 | 返信・次回対応 |
| 18 | SO-003 | P0 | pending | Sol T4 -> Terra | LL-004, SO-001 | - | 配信拒否・重複接触guard |
| 19 | SO-004 | P0 | pending | Sol T4 | SO-002, SO-003 | - | 商談状態・履歴設計 |
| 20 | SO-005 | P0 | pending | Terra T3 + Sol audit | SO-004 | - | 商談状態・履歴実装 |
| 21 | LS-006 | P1 | pending | Terra T3 | LS-005 | - | 逐次候補追加 |
| 22 | LL-001 | P1 | pending | Terra T3 | LR-001, LR-004 | - | server pagination/filter |
| 23 | LL-002 | P1 | pending | Luna T2 | LL-001 | - | 全件CSV/TSV |
| 24 | LM-004 | P1 | pending | Sol T4 -> Terra | LM-003, LL-003 | - | 構造化分析値 |
| 25 | LM-005 | P1 | pending | Terra T3 | LM-003 | - | AI予算guard |
| 26 | SM-001 | P1 | pending | Terra T3 | SO-005, LL-001 | - | 営業成績 |
| 27 | LA-001 | P1 | deferred | Sol T4 | LL-004 | - | 本番送信を再優先化するまで後回し |
| 28 | LA-002 | 公開前 | pending | Sol T4 | LR-002 | - | 認証設計 |
| 29 | LA-003 | 公開前 | pending | Terra T3 + Sol audit | LA-002 | - | 認証実装 |
| 30 | LA-004 | 公開前 | pending | Sol T4 | LA-003 | - | RBAC・監査・データ分離 |
| 31 | LA-005 | 公開前 | pending | Sol T4 -> Terra | LA-003, LS-006 | - | job所有者・永続化 |
| 32 | LO-001 | 公開前 | pending | Terra T3 | LA-003 | - | 構造化ログ |
| 33 | LO-002 | 公開前 | pending | Terra T3 | LR-003, LA-004 | - | CI・本番artifact |
| 34 | LA-006 | 公開前 | pending | Sol T4 -> Terra | LA-003, LO-002 | - | バックアップ・復元確認 |
| 35 | LO-003 | P1 | pending | Terra T3 | LM-005, LO-001 | - | 監視・費用表示 |
| 36 | LP-001 | 販売後 | deferred | Sol T4 | LA-004, SM-001 | - | 課金・契約 |

## Deferred backlog

| Task | Status | Reason |
|---|---|---|
| LB-001 Gmail返信自動同期 | deferred | 送信後対応は後回し |
| LB-002 参考メールRAG | deferred | P0/P1品質安定後 |
| LB-003 GREEN FUNDING | deferred | 現行2provider安定後 |
| LB-004 HP/SNS/連絡先自動探索 | deferred | 認証・監査後 |
| LB-005 site message/contact form送信 | deferred | 外部送信は後回し |
| LB-006 Queue/Worker/DLQ | deferred | 本番送信を再優先化した時 |
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
| 2026-07-15 | LM-001 | Terra worker + main audit | start | `/api/mails/draft` のTODO placeholder廃止と既存local generator接続を開始 |
| 2026-07-15 | LM-001 | Terra worker + main audit | complete | manual本文を維持し、未入力・空文字は既存案件固有generatorへ接続。60 suites・172 tests、build成功 |
| 2026-07-15 | LM-002 | Luna worker + main audit | start | 米びつ・食品・イベント・生活用品の案件間混入を検出するgolden dataset作成開始 |
| 2026-07-15 | LM-002 | Luna worker + main audit | complete | 6案件のgolden datasetを追加。イベント案件への商品表現混入と手動魅力文の文法崩れを検出 |
| 2026-07-15 | LM-003 | Terra worker + Sol audit | start | golden testを弱めず、案件種別に応じた分析・本文と魅力文正規化を修正開始 |
| 2026-07-16 | LM-003 | Terra worker + Sol audit | complete | 商品・食品・イベント・店舗案件を分離し、別案件メモ混入と文法崩れを防止。64 suites・198 tests、integration、build成功 |
| 2026-07-16 | LS-001 | Terra worker + main audit | complete | browser acquisition・provider parser・normalizerを分離する契約、fallback、sanitized fixture、段階移行単位を文書化 |
| 2026-07-16 | LS-007 | Terra worker + main audit | complete | 正規化会社名・URLのtransaction advisory lockを追加。同一URL、同一会社別URL、一部失敗を専用DBで検証し4 tests成功 |
| 2026-07-16 | ROADMAP-OPS | Luna explorers + main audit | complete | 取得、連絡先、手動送信、返信、商談、配信拒否、営業成績、大量データ、認証、バックアップ、課金をP0/P1/公開前/販売後へ再編 |
| 2026-07-16 | LS-002 | Luna worker + main audit | complete | Makuake listing・detail・profileをsanitized fixture化。金額と日数の結合、50日→150日、販売中・日数なしを固定 |
| 2026-07-16 | LS-003 | Luna worker + main audit | complete | CAMPFIRE listing・detail・profileをsanitized fixture化。汎用project link fallbackとカテゴリ境界を追加 |
| 2026-07-16 | LS-004 | Terra T3 + read-only audit agent | complete | 検索診断契約、6終了理由、停止後失敗上書き防止、API/UI表示を実装。71 suites・233 tests・OpenAPI・Prisma・build成功 |
| 2026-07-16 | LS-005 | Terra T3 + Sol audit agent | complete | job固有AbortSignalを両providerへ伝播し、context→browserをclose-once化。cancel競合、2秒以内停止をmock Playwrightで固定。74 suites・240 tests・build成功 |
| 2026-07-17 | LL-003 | Terra T3 + read-only audit agent | complete | Company・Project・Leadの一括編集、null消去、日程分離、手入力メモ保護、案件なし409、Lead再読込と取得処理のadvisory lock、query付きURL保持、スコア再計算の日程保護を実装。77 suites・252 tests、実DB5 tests、OpenAPI・Prisma・build成功 |
| 2026-07-17 | LL-004 | Terra T3 + Sol audit agent | complete | 会社単位の複数連絡先CRUD、primary排他、配信停止、営業・メール画面の共通管理UI、宛先解決、古い宛先拒否、レビューから送信直前までの停止guardを実装。84 suites・287 tests、実DB6 tests、OpenAPI・Prisma・build成功 |
| 2026-07-18 | SO-002 | Terra T3 + Luna audit agent | complete | 返信8分類、Lead・Task・Contact・EmailEventの原子更新、同一返信の同時重複防止、返信一覧のTask期限、今日・期限超過のserver paginationを実装。OpenAPI 71 operations、86 suites 297 tests、実DB4 suites 8 tests、Prisma・build成功 |
