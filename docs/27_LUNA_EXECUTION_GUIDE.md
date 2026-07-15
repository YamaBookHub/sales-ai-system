# 27_LUNA_EXECUTION_GUIDE

## 0. この文書の目的

この文書は、GPT-5.6 Luna相当のモデルが管理担当となり、残作業を1件ずつ安全に実行するための指示書である。

Lunaは通常の実装担当として使う。設計、安全性、認証、DB、実送信、複数moduleの変更が必要なタスクでは、Lunaが無理に実装せず、`docs/22_AI_MODEL_ROUTING.md` に従ってTerraまたはSol相当へ委譲する。

進捗の正本は `docs/28_REMAINING_WORK_STATUS.md` とする。毎回、`status = pending` かつ依存タスクが完了している最上段の1件だけを選ぶ。

## 1. 作業開始時に必ず読むもの

次の順で読む。

1. `AGENTS.md`
2. `COMPLETENESS_REPORT.md`
3. `docs/19_LOW_MODEL_HANDOFF.md`
4. `docs/22_AI_MODEL_ROUTING.md`
5. この文書
6. `docs/28_REMAINING_WORK_STATUS.md`
7. 変更対象moduleの `README.md`

UIの旧48タスクは完了済みである。新しい回帰がない限り、`docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md` から次タスクを探さない。

## 2. 正本の優先順位

現時点では一部の仕様書が古い。矛盾した場合は次の順で判断する。

1. `AGENTS.md` の安全ルール
2. `prisma/schema.prisma` とmigration
3. controller / dto / domain / usecaseの現行コード
4. 現行テスト
5. `COMPLETENESS_REPORT.md`
6. この文書と進捗表
7. module README
8. `docs/06_API.md`、`docs/07_DATABASE.md`、`openapi/openapi.yaml`

`LR-001` と `LR-002` が完了した後は、APIとDBの仕様書も正本へ戻す。

## 3. 絶対に変えてはいけないこと

- AI生成メールは `draft` 保存まで。自動送信しない。
- `approved` 以外を `queued` にしない。
- checklist未完了のメールを承認・queueしない。
- 同じleadへ重複メールを作らない。
- OpenAI失敗時に既存メール、lead、checklistを変更しない。
- `MAIL_SEND_ENABLED=true` がない限り実送信しない。
- Gmail providerをsite message / contact formへ使わない。
- `sending` で止まったメールを自動再送しない。
- 重複URLを新規案件として取り込まない。
- 外部取得元の差分をdomainやdashboardへ漏らさない。
- `/`、`/today`、`/replies`、`/leads-view`、`/mail-workspace` を変えない。
- 既存API、DOM ID、主要classを理由なく変えない。
- ユーザーや別エージェントの変更を削除・巻き戻ししない。
- `git reset --hard`、`git checkout --`、破壊的data操作をしない。
- 実OpenAI、実Gmail送信、外部サイトへの書き込みを、タスク指示なしで実行しない。

## 4. Lunaの標準作業手順

### 4.1 Preflight

```bash
git status --short
git log -1 --oneline
npm run build
npm test -- --runInBand
```

baselineが失敗した場合は編集を始めない。失敗内容と既存差分を記録する。

### 4.2 タスク開始

1. `docs/28_REMAINING_WORK_STATUS.md` から1件選ぶ。
2. statusを `in_progress` にする。
3. Task cardの許可ファイル、禁止ファイル、依存、tierを確認する。
4. 変更対象がカードより広い場合は編集せず昇格する。
5. 先に失敗するテストを追加できるタスクは、テストから始める。

### 4.3 変更上限

- Lunaが直接変更するのは原則1module、4ファイル以内。
- docs-onlyはこの上限外だが、意味のない一括整形をしない。
- 4ファイルを超える、2moduleへ広がる、schema/API契約が変わる場合はTerra以上へ委譲する。
- 安全ルール、認証、実送信はSol監査を必須とする。

### 4.4 検証

通常:

```bash
npm run build
npm test -- --runInBand
git diff --check
```

Prisma変更時:

```bash
npm run prisma:validate
npm run prisma:generate
```

実DBタスク:

```bash
TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sales_ai_system' npm run test:integration
```

ユーザーが3000番portを使用している場合、勝手にserverを起動しない。ブラウザ確認が必須のタスクは、別portを明示するか、ユーザーが開いている環境の確認を依頼する。画面確認を省略した場合は完了報告に未確認と書く。

### 4.5 完了

- 合格条件をすべて満たした場合だけstatusを `complete` にする。
- Evidenceへ日付、commitまたは`uncommitted`、test数、build結果を記録する。
- commitは依頼で許可されている場合だけ行う。
- 一部だけ成功した場合は `in_progress` のままにする。

## 5. 停止・昇格条件

次のどれかが起きたら、Lunaは修正を重ねず停止する。

- 同じ原因へ2回修正しても失敗する。
- 仕様書とコードのどちらを正本にするか判断が必要。
- 受け入れ条件が2通り以上に解釈できる。
- 予定外のschema、migration、API、認証、実送信変更が必要。
- 変更が5ファイル以上または2module以上へ広がる。
- 外部サイトのHTMLを安定して再現するfixtureがない。
- 既存未コミット変更と競合する。
- 実DB、実OpenAI、実Gmailがないと正しさを判定できない。

引き継ぎには次を残す。

```text
Task ID:
Current HEAD:
Current model/tier:
Required model/tier:
Changed files:
Uncommitted diff:
Passed checks:
Failed check:
Blocking fact:
Recommended next action:
```

## 6. 完了の定義

### ローカルMVP完成

次をすべて満たす。

1. CAMPFIRE / Makuakeの公開中案件を検索できる。
2. 指定件数に届かなければ、理由が画面とAPIで分かる。
3. 検索停止で実行中browser処理も速やかに止まる。
4. 支援額、支援者、残り日数、カテゴリ、地域、過去PJ件数をfixture testで固定する。
5. 既存URLを重複取り込みしない。
6. 取り込み後の案件詳細と分析値を人が修正できる。
7. メールへ別案件の特徴が混ざらないことをgolden testで固定する。
8. 対象選択、履歴、編集、checklist、レビュー、棄却、再レビュー、承認、queueが通る。
9. 営業案件が200件を超えてもserver paginationと全件出力が正しい。
10. 通常test、build、Prisma validate、実DBintegrationが成功する。

### 複数人運用完成

ローカルMVPに加えて、認証、RBAC、監査、検索ジョブ所有者、複数instance対応、CI、監視が必要。

### 本番送信完成

複数人運用に加えて、blocked/unsubscribe最終拒否、provider冪等性、rate limit、queue/worker、DLQ、Gmail運用監視が必要。これは当面の優先対象外とする。

## 7. タスクカード

### LR-001 API正本同期

- Priority: P0
- Model: Luna / T1 / high
- Depends on: なし
- 目的: 現行controller routeを `docs/06_API.md` と `openapi/openapi.yaml` へ反映する。
- 許可: `docs/06_API.md`, `openapi/openapi.yaml`, OpenAPI parse test追加先1ファイル
- 禁止: controller、dto、service、schemaの変更
- 手順:
  1. 全controllerのdecoratorからroute、method、query、bodyを列挙する。
  2. 実装にない `/api/ai/leads/{id}/next-action` は削除または未実装と明記する。
  3. generic project import/search/job、mail template/send/mark-sent/consistency、AI analyze/polish/semantic、tracking、navigation summaryを追加する。
  4. response wrapper `{ data, meta, error }` を維持する。
- 合格: OpenAPIをparseでき、controller routeとの差分一覧が0件。コード差分なし。
- Test: `npm run build`, `npm test -- --runInBand`

### LR-002 DB・安全仕様同期

- Priority: P0
- Model: Luna / T1 / high
- Depends on: LR-001
- 目的: 現行Prisma enum/modelとdocsの矛盾をなくす。
- 許可: `docs/07_DATABASE.md`, `docs/04_SECURITY.md`, `docs/14_DEPLOY.md`, `.env.example`
- 禁止: `prisma/schema.prisma`, migration、実装コード
- 手順:
  1. enum名と値をschemaから転記する。
  2. 実装済み、未実装、将来要件を分ける。
  3. worker/Redis/JWTを実装済みと書かない。
  4. `.env.example` と必須環境変数表を一致させる。
- 合格: docsが存在しないmodule/scriptを「実装済み」と主張しない。
- Test: `npm run prisma:validate`, `npm run build`

### LR-003 再現可能なbaseline検査

- Priority: P0
- Model: Luna / T2 / high
- Depends on: LR-001, LR-002
- 目的: OpenAPI、Prisma、test、buildを1コマンドで検査できるようにする。
- 許可: `package.json`, `scripts/`, `.github/workflows/` の検査用ファイル
- 禁止: application/domainの業務ロジック
- 手順:
  1. lint scriptがないのにdeploy docsで必須とする矛盾を解消する。
  2. OpenAPI parse、Prisma validate、test、buildを順に実行するverify scriptを追加する。
  3. GitHub Actionsは外部API keyなしで動かす。
- 合格: clean install環境を想定したverifyが成功し、OpenAI/Gmail/実サイトへ接続しない。
- 昇格: package構成変更が必要ならTerra。

### LR-004 実DB統合testの確定

- Priority: P0
- Model: Luna / T2 / high
- Depends on: LR-003
- 目的: integration testをskipではなくlocal PostgreSQLで成功させる。
- 許可: integration spec、test setup、実行手順docs
- 禁止: production data、既存migrationの書換え
- 手順:
  1. test専用DBを使う。
  2. migration適用後にintegrationを実行する。
  3. test dataを必ず削除する。
- 合格: `npm run test:integration` がskipなしで成功。
- 昇格: migration不整合はTerra、data消失リスクはSol。

### LM-001 legacy下書きplaceholder廃止

- Priority: P0
- Model: Terra / T3 / high
- Depends on: LR-004
- 目的: `/api/mails/draft` から `TODO: AI-generated...` を保存しない。
- 許可: mail controller/service、AI local draft usecaseへの薄い接続、関連spec
- 禁止: API URL、重複メール規則、mail状態遷移の変更
- 合格: manualInstructionなしでも案件固有の下書き、または明確な400。TODO本文はDBへ保存されない。
- 必須test: 既存mailあり、leadなし、manualあり、manualなし。
- 監査: mail/ai横断のためSol review。

### LM-002 メールgolden dataset

- Priority: P0
- Model: Luna / T2 / high
- Depends on: LM-001
- 目的: 案件間混入と不自然な対象者表現を固定testで検出する。
- 許可: `apps/api/src/ai/domain/fixtures/`, AI domain spec
- 禁止: prompt、DB、OpenAI実通信
- fixture: 米びつ、スモークサーモン、醤油差し、ライブ、焼き鳥店改装、防災金庫。
- 各caseに含める: company、source、title、description、category、期待語、禁止語、想定対象者。
- 合格: 全caseで会社名・案件名・sourceが一致し、他caseの禁止語が本文・analysisに出ない。

### LM-003 古い分析メモ混入防止

- Priority: P0
- Model: Terra / T3 / high
- Depends on: LM-002
- 目的: projectDescriptionだけでなくbrandAnalysisMemo / snsAnalysisMemo / leadReasonも現在案件と整合しない場合はOpenAI入力へ渡さない。
- 許可: AI domain、polish usecase、関連spec
- 禁止: OpenAI endpoint、mail状態遷移、DB schema
- 合格: サーモン案件へ米・キッチン、ライブ案件へ食品、醤油差しへ寝具のメモを渡してもOpenAI inputと本文に残らない。
- 監査: AI安全判定のためSol review。

### LM-004 構造化分析値の正本化

- Priority: P1
- Model: Sol design -> Terra implementation / T4
- Depends on: LM-003
- 目的: 【商品の魅力】【使う人】【動画の見せ方】を生成前に表示・編集・保存し、メール生成がその確定値を使う。
- 最初の作業: UI/DB変更をせず、保存先、version、編集履歴、fallbackを設計する。
- 必須条件: 元案件ID、生成日時、人間編集有無を保持。別案件へ再利用しない。
- 合格: 3値が空または未確認なら生成画面で明示され、確認済み値だけを下書きへ使う。

### LM-005 OpenAI予算guard

- Priority: P1
- Model: Terra / T3 / high
- Depends on: LM-003
- 目的: 月額予算と実行前見積を管理する。
- 許可: ai usecase/domain、設定、usage summary API、spec
- 必須: `OPENAI_MONTHLY_BUDGET_USD`、当月cost集計、上限超過拒否、日本語表示、ローカル生成は継続可能。
- 禁止: API key表示、実OpenAI test。
- 合格: 予算未設定、予算内、上限直前、上限超過をtest。

### LS-001 parser境界設計

- Priority: P0
- Model: Terra / T3 / high
- Depends on: LR-004
- 目的: browser操作とHTML抽出を分け、fixtureで検証できる境界を定める。
- 対象: projects infrastructureとCAMPFIRE scraper。
- 最初の作業: interface、parser input/output、fixture保存方針だけを設計し、挙動を変えない。
- 合格: listing/detail/profileの責務、正規化前後、selector fallback、変更ファイル単位が明記される。

### LS-002 Makuake fixture test

- Priority: P0
- Model: Luna / T2 / high
- Depends on: LS-001
- 目的: 支援額、支援者、残り日数、カテゴリ、地域、実行者名、プロジェクト数を固定する。
- 許可: Makuake parser、sanitized fixture、spec
- 必須case: `集まっている金額/寄附者/残り`、`応援購入総額/サポーター/販売中`、カンマ金額、残り8日と150日誤結合、profile 6件。
- 禁止: live siteだけに依存するtest。
- 合格: fixtureから期待値が完全一致し、金額と日数が結合しない。

### LS-003 CAMPFIRE fixture test

- Priority: P0
- Model: Luna / T2 / high
- Depends on: LS-001
- 目的: 支援額、支援者、残り日数、カテゴリ、公開状態、過去PJ件数を固定する。
- 許可: CAMPFIRE parser、sanitized fixture、spec
- 必須case: 募集中、終了、もうすぐ公開、初回PJ、100件以上。
- 合格: activeだけを候補にし、終了/公開前を除外し、件数条件を正しく判定する。

### LS-004 検索終了理由

- Priority: P0
- Model: Terra / T3 / high
- Depends on: LS-002, LS-003
- 目的: 指定10件に対し8件で終わった理由をAPI/UIへ返す。
- 必須reason: `desired_reached`, `source_exhausted`, `condition_shortage`, `excluded_existing`, `cancelled`, `failed`。
- 許可: project search domain/usecase/job DTO、dashboard表示、spec
- 合格: `候補8件`だけでなく`条件一致が8件のため完了`など理由を表示し、件数を偽らない。

### LS-005 実行中検索の即時停止

- Priority: P0
- Model: Terra / T3 / high
- Depends on: LS-004
- 目的: cancel時に次loopだけでなくPlaywright context/page処理も停止する。
- 必須: AbortSignal相当をproviderへ渡す。close競合を正常終了として扱う。browser/contextを二重closeしない。
- 合格: cancel後2秒以内を目標にjobがcancelledになり、未処理pageを開かない。unit testで固定。
- 監査: 外部browser lifecycleのためSol review。

### LS-006 逐次候補追加

- Priority: P1
- Model: Terra / T3 / high
- Depends on: LS-005
- 目的: provider全体完了前に、取得済み候補をjobへ追加してpolling UIへ表示する。
- 必須: item callbackまたはasync iterator、URL重複排除、順序安定、cancel対応。
- 合格: 10件検索中に1件以上の中間状態が観測できる。既存候補が点滅・消失しない。

### LS-007 取り込み排他integration

- Priority: P0
- Model: Terra / T3 / high
- Depends on: LR-004
- 目的: 同じURLを並列一括取り込みしてもCompany / Project / Leadを重複作成しない。
- 許可: import policy/repository/integration spec、必要なら非破壊migration
- 合格: 同一URL同時実行、同一会社別URL、一部失敗を実DBで検証。
- 監査: migrationが必要ならSol。

### LL-001 server pagination/filter/sort

- Priority: P1
- Model: Terra / T3 / high
- Depends on: LR-001, LR-004
- 目的: 200件上限のclient-only一覧をserver paginationへ移す。
- 必須filter: source、lead status、priority、contact state、mail status、next action。
- 必須sort: company、project、amount、supporters、daysLeft、score、priority、createdAt。
- 合格: 201件以上fixtureで全pageへ到達し、filter後totalが正しい。選択状態を維持。

### LL-002 本当の全件CSV/TSV

- Priority: P1
- Model: Luna / T2 / high
- Depends on: LL-001
- 目的: 表示中、現在filter全件、選択列を区別して出力する。
- 必須: sort順維持、UTF-8 BOM CSV、TSV、改行/tab/quote escape。
- 合格: 201件以上を欠落なく出力し、表示中scopeは現在pageだけ。

### LL-003 詳細編集契約

- Priority: P1
- Model: Terra / T3 / high
- Depends on: LL-001
- 目的: 選択案件の会社・案件・営業・分析・連絡先項目を、手入力または選択肢で更新できる契約を完成する。
- 最初の作業: 現在編集可/読取専用/自動再計算をdata mapping表へ記録する。
- 合格: 保存後再読込で一致し、自動再分析で人間編集値を勝手に上書きしない。

### LL-004 Contact CRUD

- Priority: P1
- Model: Terra / T3 / high
- Depends on: LL-003
- 目的: 会社の複数連絡先、primary、配信停止、問い合わせURLを管理する。
- 合格: create/update/archive、primary一意、unsubscribe維持、lead選択画面への反映をtest。
- 監査: 個人情報・配信停止のためSol review。

### LA-001 送信直前安全guard

- Priority: P1
- Model: Sol / T4
- Depends on: LL-004
- 目的: blocked company、unsubscribed contact、宛先なし、checklist未完了、approved以外を共通guardで拒否する。
- 合格: provider claim前に全拒否条件をtestし、拒否時はmail状態を変更しない。
- 注意: 実送信は有効にしない。

### LA-002 認証設計

- Priority: P1
- Model: Sol / T4
- Depends on: LR-002
- 目的: local/staging/productionのログイン、session/JWT、Google OAuth、current user、seed admin、logoutを設計する。
- このタスクでは実装しない。
- 合格: trustするheaderを廃止する移行順、API/画面保護範囲、ローカル開発手段を決定する。

### LA-003 認証実装

- Priority: P1
- Model: Terra / T3 / high
- Depends on: LA-002
- 目的: 承認済み設計どおりにcurrent userとguardを追加する。
- 合格: 未認証401、inactive user拒否、ログイン/ログアウト、local test userをtest。
- 監査: Sol。

### LA-004 RBACと監査

- Priority: P1
- Model: Sol / T4
- Depends on: LA-003
- 目的: operator/manager/admin/viewer権限と重要操作AuditLogを実装する。
- 必須監査: import、分析、生成、編集、レビュー、棄却、承認、queue、send、unsubscribe、user/role変更。
- 合格: operatorはapprove/queue不可、managerは可、viewerは更新不可。actorは認証userから取得。

### LA-005 検索ジョブ所有者と永続化

- Priority: P1
- Model: Sol design -> Terra implementation / T4
- Depends on: LA-003, LS-006
- 目的: jobをプロセスメモリから共有storeへ移し、owner以外の閲覧/停止を防ぐ。
- 合格: restart後状態、複数instance、owner隔離、TTL、cancelをintegration test。

### LO-001 構造化ログとrequest ID

- Priority: P2
- Model: Terra / T3 / high
- Depends on: LA-003
- 目的: 本文・平文email・IPを出さず、requestId/userId/entity/eventを記録する。
- 合格: 5xx、AI失敗、scraper失敗、mail失敗のlog contract test。

### LO-002 CIと本番artifact

- Priority: P2
- Model: Terra / T3 / high
- Depends on: LR-003, LA-004
- 目的: verify、migration確認、Docker buildをCIで固定する。
- 必須: production multi-stage Dockerfile、secretなしtest、migrate deploy手順。
- 禁止: 本番deployの自動実行。

### LO-003 監視と予算表示

- Priority: P2
- Model: Terra / T3 / high
- Depends on: LM-005, LO-001
- 目的: AI費用、失敗、検索時間、取り込み失敗、返信、mail状態を運用画面へ表示する。
- 合格: 期間filter、0件、DB失敗、個人情報maskをtest。

## 8. 後回しにするbacklog

次は上記P0/P1完了後に、1件ずつ新しいTask cardへ分解する。

| ID | 内容 | 最低tier | 開始条件 |
|---|---|---:|---|
| LB-001 | Gmail返信自動同期 | T4 | 認証・監査・rate limit完了 |
| LB-002 | 参考メールRAG | T4 | mail golden datasetと費用guard完了 |
| LB-003 | GREEN FUNDING provider | T3 | parser境界とprovider fixture標準完了 |
| LB-004 | 会社HP/SNS/連絡先の自動探索 | T4 | 認証・個人情報・監査完了 |
| LB-005 | site message / contact form送信 | T4 | 送信安全guard・監査・個別利用規約確認 |
| LB-006 | Queue/Worker/DLQ | T4 | 本番送信を再優先化した時 |
| LB-007 | 面談・提案・見積・契約管理 | T3 | ローカルMVP運用評価後 |
| LB-008 | Calendar/通知/ポモドーロ | T3 | Google OAuthとuser identity完了 |

## 9. Lunaへ渡す依頼文

```text
sales-ai-systemの残作業を1件だけ進めてください。

必読:
- AGENTS.md
- COMPLETENESS_REPORT.md
- docs/19_LOW_MODEL_HANDOFF.md
- docs/22_AI_MODEL_ROUTING.md
- docs/27_LUNA_EXECUTION_GUIDE.md
- docs/28_REMAINING_WORK_STATUS.md
- 対象moduleのREADME.md

手順:
1. status=pendingで依存が完了した最上段のTask IDを1件選ぶ
2. preflightのbuild/testを確認する
3. statusをin_progressへ更新する
4. Task cardの許可範囲だけ変更する
5. 必要tierがLunaを超える場合は、適切な上位subagentへ委譲する
6. build/test/diff-check、必要な追加検証を行う
7. 全条件成功時だけcompleteにし、Evidenceを記録する
8. 1件完了後に次タスクへ勝手に進まない

実OpenAI、実Gmail送信、外部サイトへの書き込みは行わない。
既存変更を削除・巻き戻ししない。
```
