# 28_REMAINING_WORK_STATUS

## 使い方

- `pending`: 未着手
- `in_progress`: 作業中、検証未完了、またはhandoff待ち
- `complete`: Task cardの合格条件と検証をすべて満たした
- `deferred`: ユーザー判断で後回し

上から順に、依存がすべてcompleteのpendingタスクを1件だけ選ぶ。

Baseline:

- Snapshot date: 2026-07-18
- Base HEAD before LL-002: `a0a3977`
- Unit/contract tests: 90 suites / 358 tests passed
- Build: passed
- Prisma validate: passed
- Integration: dedicated `sales_ai_system_test` DBで6 suites / 23 tests passed
- Browser: ユーザー指示により未実行（port 3000を使用しない）

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
| 18 | SO-003 | P0 | complete | Sol T4 -> Terra | LL-004, SO-001 | 2026-07-18 / 送信先snapshot・共通guard・advisory lock・86 suites 306 tests・実DB12 tests成功 | 配信拒否・重複接触guard |
| 19 | SO-004 | P0 | complete | Sol T4 | SO-002, SO-003 | 2026-07-18 / Opportunity分離・状態・DB・API・権限・移行・rollback契約 | 商談状態・履歴設計 |
| 20 | SO-005 | P0 | complete | Terra T3 + Sol audit | SO-004 | 2026-07-18 / 8段階・履歴・排他・冪等・自動進行・UI、87 suites 331 tests・実DB21 tests・移行58/58件成功 | 商談状態・履歴実装 |
| 21 | LS-006 | P1 | complete | Terra T3 + Sol audit | LS-005 | 2026-07-18 / 両provider逐次通知・Makuake確定値4件並列・URL重複排除・10件上限・停止/旧応答guard、88 suites 337 tests・verify成功 | 逐次候補追加 |
| 22 | LL-001 | P1 | complete | Terra T3 + Sol audit | LR-001, LR-004 | 2026-07-18 / DB側pagination・filter・sort、最新メールCTE、実DB201件到達、選択維持、89 suites 351 tests・実DB23 tests・verify成功 | server pagination/filter |
| 23 | LL-002 | P1 | complete | Luna T2 | LL-001 | 2026-07-18 / 現在ページ・現在条件全件を分離、100件単位・最大4並列、server sort維持、CSV BOM・TSV escape、201件到達、90 suites 358 tests・verify成功 | 全件CSV/TSV |
| 24 | LM-004 | P1 | complete | Sol T4 -> Terra | LM-003, LL-003 | 2026-07-19 / 追記専用version・案件fingerprint・確認API・メール固定、91 suites 365 tests・実DB7 suites 26 tests・build成功 | 構造化分析値 |
| 25 | LM-005 | P1 | complete | Terra T3 + Sol audit | LM-003 | 2026-07-19 / JST月次予算・DB予約排他・429停止・usage API、93 suites 380 tests・実DB8 suites 27 tests・verify成功 | AI予算guard |
| 26 | SM-001 | P1 | complete | Terra T3 + Sol audit | SO-005, LL-001 | 2026-07-19 / JST期間・担当者・取得元filter、送信4指標・失注理由、97 suites 393 tests・実DB9 suites 32 tests・verify成功 | 営業成績 |
| 27 | LA-001 | P1 | deferred | Sol T4 | LL-004 | - | 本番送信を再優先化するまで後回し |
| 28 | LA-002 | 公開前 | complete | Sol T4 | LR-002 | 2026-07-19 / session・Google OAuth・local/test・保護範囲・CSRF・header廃止・rollback契約 | 認証設計 |
| 29 | LA-003 | 公開前 | complete | Terra T3 + Sol audit | LA-002 | 2026-07-19 / Cookie session・Google OIDC・local/test session・CSRF・actor固定、OpenAPI 90 operations、107 suites 422 tests・Prisma・build成功 | 認証実装 |
| 30 | LA-004 | 公開前 | complete | Sol T4 | LA-003 | 2026-07-20 / 15 permission・fail-closed metadata・admin管理API・transaction内actor/session監査・保存時と監査APIの二重mask・OpenAPI 95 operations・122 suites 478 tests・build成功 | 単一組織内のRBAC・監査 |
| 31 | LA-007 | 公開前 | in_progress | Sol T4 -> Terra | LA-004 | 2026-07-20 / 組織境界・移行・全read/write scopeの設計と棚卸しを開始 | 組織ごとのデータ分離 |
| 32 | LA-005 | 公開前 | pending | Sol T4 -> Terra | LA-003, LS-006 | - | job所有者・永続化 |
| 33 | LO-001 | 公開前 | pending | Terra T3 | LA-003 | - | 構造化ログ |
| 34 | LO-002 | 公開前 | pending | Terra T3 | LR-003, LA-004, LA-007 | - | CI・本番artifact |
| 35 | LA-006 | 公開前 | pending | Sol T4 -> Terra | LA-003, LO-002 | - | バックアップ・復元確認 |
| 36 | LO-003 | P1 | pending | Terra T3 | LM-005, LO-001 | - | 監視・費用表示 |
| 37 | LP-001 | 販売後 | deferred | Sol T4 | LA-007, SM-001 | - | 課金・契約 |

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
| 2026-07-18 | SO-003 | Sol design audit + Terra implementation | complete | email・問い合わせURL・サイト内URLの正規化snapshot、会社block・配信停止・別Lead重複の共通guard、送信先advisory lockを実装。OpenAPI 71 operations、86 suites 306 tests、実DB5 suites 12 tests、Prisma・build成功 |
| 2026-07-18 | SO-004 | main + Terra/Sol read-only audit agents | complete | LeadStatus拡張を採用せず、SalesLead 1:1 Opportunityを商談正本とする契約を決定。状態遷移、履歴、担当、金額、確度、予定日、失注理由、API、権限、集計、排他、既存Lead移行、rollback、SO-005検証条件を文書化 |
| 2026-07-18 | SO-005 | Terra workers + Sol audit + main | start | OpportunityのDB・API・業務連携・営業画面を並行実装し、既存Lead移行と競合制御の検証を開始 |
| 2026-07-18 | SO-005 | Terra workers + Sol audit + main | complete | 8段階、append-only履歴、version競合、入力指紋付きoperationKey冪等、削除済みLead遮断、終端確認、メール送信・返信からの自動進行を実装。OpenAPI 77 operations、87 suites 331 tests、実DB6 suites 21 tests、Prisma・build成功。開発DBはLead 58件・Opportunity 58件・欠損0件 |
| 2026-07-18 | LS-006 | Terra worker + Sol audit + main | start | CAMPFIRE・Makuakeの取得済み候補をprovider完了前に検索jobへ追加する実装を開始 |
| 2026-07-18 | LS-006 | Terra worker + Sol audit + main | complete | 両providerの逐次通知、Makuake詳細確定値の4件並列追加、正規化URL重複排除、順序安定、指定件数上限、停止後拒否、旧検索応答guardを実装。OpenAPI 77 operations、88 suites 337 tests、Prisma・build成功 |
| 2026-07-18 | LL-001 | Terra workers + Sol audit + main | start | 営業リストの全件メモリ取得を廃止し、server pagination・filter・sortと選択維持の実装を開始 |
| 2026-07-18 | LL-001 | Terra workers + Sol audit + main | complete | 最新メールをPostgreSQL CTEで判定し、同一snapshotで集計・IDページング・当該ページのみhydrate。取得元・状態・優先度・連絡先・最新メール・次対応filter、8種sort、実DB201件の全ページ到達、ページ変更後の選択維持を実装。OpenAPI 77 operations、89 suites 351 tests、実DB6 suites 23 tests、Prisma・build成功。ブラウザはユーザー指示により未実行 |
| 2026-07-18 | LL-002 | Luna worker + main audit | start | 営業リスト出力を現在ページと現在条件全件に分離し、全ページ収集とCSV/TSV契約の実装を開始 |
| 2026-07-18 | LL-002 | Luna worker + main audit | complete | 現在ページは表示中のみ、全件はfilter・server sortを保持して100件単位・最大4並列で収集。CSV UTF-8 BOM、改行・タブ・引用符escape、201件の欠落なしと順序維持を固定。OpenAPI 77 operations、90 suites 358 tests、Prisma・build成功。ブラウザはユーザー指示により未実行 |
| 2026-07-18 | LM-004 | Sol design agents + main | start | 構造化3値の正本、追記専用version、案件fingerprint、確認、メール使用版固定の設計を開始 |
| 2026-07-19 | LM-004 | Sol T4 + read-only audit agents + main | complete | 魅力・対象者・動画案を追記専用revisionへ保存し、案件fingerprint・編集競合・再取り込み排他・確認済み最新版・メール使用版固定を実装。OpenAPI・Prisma、91 suites 365 tests、実DB7 suites 26 tests、build成功。ブラウザとport 3000はユーザー指示により未実行 |
| 2026-07-19 | LM-005 | Terra T3 + Sol read-only audit + main | complete | OpenAI実行前の概算費用をDB台帳へ予約し、月額上限と同時実行をguard。JST当月summary API、日本語429、既存費用backfill、Gemini・ローカル継続を実装。OpenAPI 81 operations、93 suites 380 tests、実DB8 suites 27 tests、build成功。実OpenAI・ブラウザ・port 3000は未使用 |
| 2026-07-19 | SM-001 | Terra T3 + Sol read-only audit + main | complete | 実送信日時を正本に、送信数・返信率・商談率・受注率・失注理由をDB集計。JST期間、現・過去担当者、取得元、送信後の時系列、重複除外、終了境界、ゼロ件を固定し、連続条件変更の旧応答も遮断。OpenAPI 84 operations、97 suites 393 tests、実DB9 suites 32 tests、Prisma・build成功。ブラウザとport 3000はユーザー指示により未実行 |
| 2026-07-19 | LA-002 | Sol T4 design agents + main | complete | opaque session、Google OAuth/OIDC、local/test login、current user、Cookie/CSRF、画面/API保護範囲、bootstrap admin、`X-Operator-Email` 廃止順、単一組織制限、LA-003実装順・必須test・rollbackを契約化。コード・DB・OpenAPIは未変更 |
| 2026-07-19 | LA-003 | Terra T3 + Sol read-only audit + main | start | session DB、Google OIDC、local login、CSRF、保護範囲、actor伝播、bootstrap adminの実装を開始 |
| 2026-07-19 | LA-003 | Terra T3 + Sol read-only audit + main | complete | opaque Cookie session、Google Authorization Code + PKCE/OIDC検証、loopback限定local login、test専用session helper、CSRF、画面/API保護、current user伝播、初期admin作成を実装。OAuth失敗時のstate破棄、実送信actor、保護mutation 48件のCSRF仕様も監査後に補強。OpenAPI 90 operations、107 suites 422 tests、Prisma・build成功。DB integrationとブラウザは実行環境制限およびユーザー指示により未実行 |
| 2026-07-20 | LA-004 | Sol T4 design + Terra implementation + Sol audit + main | complete | 15 permissionのrole matrix、全保護operationのfail-closed metadata、メール承認/queue/実送信の権限、admin user/audit API、permissions配列、同一transactionのsession付きAuditLog、保存時とAPI応答時の禁止情報mask、最後のadmin/self-lockout防止を反映。OpenAPI 95 operations、122 suites 478 tests、Prisma validate・build成功。実DBintegrationはDocker socket権限制限、ブラウザ・port 3000はユーザー指示により未実行 |
| 2026-07-20 | LA-007 | Sol T4 design + Terra inventory + main | start | Organization、Membership、session active organization、業務データscope、既存データ移行、DB越境拒否、検索job・export・集計の組織境界を設計開始 |
