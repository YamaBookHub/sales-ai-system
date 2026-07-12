# 21_UIUX_IMPLEMENTATION_STATUS

## 目的

`docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md` の実装状況を、低いモデルでも機械的に判断できるようにする。

状態:

- `pending`: 未着手
- `in_progress`: 作業中または確認失敗あり
- `complete`: 受け入れ条件、build、testをすべて確認済み
- `blocked`: 外部判断または別タスクが必要

## 更新ルール

1. 1回の作業で1行だけ更新する。
2. 作業開始時に対象を `in_progress` にする。
3. build、test、必要なブラウザ確認が成功した後だけ `complete` にする。
4. `complete` には確認日とcommit hashを記録する。未commitなら `uncommitted` と記録する。
5. 失敗した場合は `in_progress` のままNoteへ理由を書く。
6. 依存するタスクが `complete` でなければ着手しない。
7. 編集開始前に、使用モデル、tier、reasoning、選択理由をExecution logへ記録する。
8. モデルを途中変更した場合は、変更前後を別行で記録する。

## Status

| Task | Status | Depends on | Evidence | Note |
|---|---|---|---|---|
| UX-A01 | complete | - | 2026-07-12 / cbc7eac / npm test -- --runInBand OK / npm run build OK | dashboard HTML契約テスト |
| UX-A02 | complete | UX-A01 | 2026-07-12 / 33524e1 / npm test -- --runInBand OK / npm run build OK | 安定したUI目印 |
| UX-A03 | complete | UX-A02 | 2026-07-12 / 06f49f0 / npm test -- --runInBand OK / npm run build OK | dashboard README |
| UX-A04 | complete | UX-A01, UX-A02 | 2026-07-12 / 62d0094 / npm test -- --runInBand OK / npm run build OK | mailWorkspace文字列置換廃止 |
| UX-B01 | complete | UX-A04 | 2026-07-12 / uncommitted / 30 suites・92 tests・build OK | 3画面の業務用語統一、曖昧な「無料」表記を除去 |
| UX-B02 | complete | UX-B01 | 2026-07-12 / uncommitted / dashboard spec・build OK | `/`だけ候補検索を初期表示、mail workspaceは閉じた状態を維持 |
| UX-B03 | complete | UX-B01 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | loading・empty・errorを区別し、API失敗時に再試行案内を表示 |
| UX-C01 | complete | UX-B03 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | mail状態ごとに有効な主操作だけを動的強調。補助操作は通常表示 |
| UX-C02 | complete | UX-C01 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 会社・mail状態・checklist・次操作のsticky summary |
| UX-C03 | complete | UX-C02 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 981px以上を対象キューと作業領域の2ペインにする |
| UX-C04 | complete | UX-C03 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 作業領域4タブとmail状態による初期タブ |
| UX-C05 | complete | UX-C03 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 現在の絞り込み・並び順で次の案件へ |
| UX-C06 | complete | UX-C04, UX-C05 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 基準値・未保存表示・移動/離脱警告 |
| UX-D01 | complete | UX-C03 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 本文横で案件情報を見比べる |
| UX-D02 | complete | UX-D01 | 2026-07-12 / uncommitted / 31 suites・95 tests・build・browser OK | AI根拠・仮定・リスク |
| UX-D03 | complete | UX-D01, UX-D02 | 2026-07-12 / uncommitted / 32 suites・101 tests・build・browser OK | 決定的整合性チェック |
| UX-D04 | complete | UX-D03 | 2026-07-12 / uncommitted / 33 suites・103 tests・build・browser OK | レビュー前警告 |
| UX-D05 | complete | UX-D03, UX-D04 | 2026-07-12 / uncommitted / 35 suites・108 tests・build・browser OK | 任意のAI意味整合性確認 |
| UX-E00 | complete | UX-B03 | 2026-07-12 / uncommitted / `docs/24_SALES_LIST_DATA_MAPPING.md` | 既存data、fallback、返信・資料閲覧のAPI不足、共通mappingを固定 |
| UX-E01 | complete | UX-B01, UX-B02, UX-B03, UX-E00 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | summary cardから既存filterへ絞り込み |
| UX-E02 | complete | UX-E01 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | CSV/TSV出力を折りたたみの補助操作へ移す |
| UX-E03 | complete | UX-E00 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 既存dataだけで今対応する理由を表示 |
| UX-E04 | complete | UX-E01 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | desktop右詳細・mobile下配置・一覧位置保持 |
| UX-F01 | complete | UX-E00 | 2026-07-12 / uncommitted / 31 suites・95 tests・build OK | 今日の営業分類をdomain純粋関数へ追加 |
| UX-F02 | complete | UX-F01, UX-A04 | 2026-07-12 / uncommitted / 32 suites・101 tests・build・browser OK | /today画面 |
| UX-F03 | complete | UX-F02 | 2026-07-12 / uncommitted / 33 suites・103 tests・build・browser OK | ナビ件数バッジ |
| UX-F04 | complete | UX-F02, UX-F03 | 2026-07-12 / uncommitted / 35 suites・108 tests・build・browser OK | today初期導線 |
| UX-G01 | complete | - | 2026-07-12 / uncommitted / `docs/25_REPLY_INBOX_API_DESIGN.md` | Reply API差分調査 |
| UX-G02 | complete | UX-G01 | 2026-07-12 / uncommitted / 36 suites・120 tests・build OK | Reply view model |
| UX-G03 | complete | UX-G01, UX-G02 | 2026-07-12 / uncommitted / 37 suites・123 tests・build OK | Reply repository query |
| UX-G04 | complete | UX-G02, UX-G03 | 2026-07-12 / uncommitted / 39 suites・125 tests・build・API実data OK | Reply API usecase/controller |
| UX-G05 | complete | UX-G04 | 2026-07-12 / uncommitted / 39 suites・126 tests・build・browser・API実data OK | `/replies`画面、返信分類/対応状態/並び順、空・エラー・manager確認・追客停止状態 |
| UX-G06 | complete | UX-G05 | 2026-07-12 / uncommitted / `docs/26_NEXT_ACTION_DESIGN.md`・schema/migration/code audit・39 suites・126 tests・build・diff-check OK | 既存Taskを正本にし、DB変更なしと判断 |
| UX-G07 | complete | UX-G06 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・API実data OK | Task API、状態遷移、担当候補、LeadのnextTask summary |
| UX-G08 | complete | UX-G07 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・API・HTML script parse OK | Lead詳細のTask入力、状態操作、保存状態、今日の営業へのnextTask反映 |
| UX-H01 | complete | UX-C06, UX-D04, UX-E04, UX-F04, UX-G08 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・diff-check OK | 4 rendererへcolor/spacing/radius/font/shadow/control tokensを追加 |
| UX-H02 | complete | UX-H01 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・diff-check OK | focus-visible、Lead/Mail行のEnter/Space選択 |
| UX-H03 | complete | UX-H01 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・diff-check OK | 既存label維持、状態/件数/Task保存のaria-live通知 |
| UX-H04 | complete | UX-H01 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・diff-check・responsive CSS audit OK | 1440/1024/390幅。700px以下のheader縦積みと局所overflow |
| UX-H05 | complete | UX-C03, UX-E04 | 2026-07-12 / uncommitted / 44 suites・136 tests・build・diff-check・HTML script parse OK | Lead一覧を20件client paging。API paginationは変更せず、filter/sort/selected leadを維持 |
| UX-I01 | complete | UX-A04 | 2026-07-12 / uncommitted / 30 suites・92 tests・build OK / 3画面SHA-256一致 | controller 4,297行→24行、page rendererとshellを分離 |
| UX-I02 | complete | UX-I01, UX-H01 | 2026-07-12 / uncommitted / 45 suites・140 tests・build・diff-check・4画面CSS/script parse OK | 4rendererのCSSをshared-styles.tsへ移動。selectorとstyle出力順を維持 |
| UX-I03 | complete | UX-I02 | 2026-07-12 / uncommitted / 46 suites・141 tests・build・diff-check・static DOM contract・5 route/API 200 | 候補検索・候補URL一覧をurl-search-page.tsへ移動。client関数と既存DOM/APIは維持 |
| UX-I04 | complete | UX-I02 | 2026-07-12 / uncommitted / 47 suites・142 tests・build・diff-check・static DOM contract・/leads-view 200 | Lead一覧の静的HTMLをleads-page-static.tsへ移動。client処理、DOM id、API呼び出しは維持 |
| UX-I05 | complete | UX-I02 | 2026-07-12 / uncommitted / 48 suites・143 tests・build・diff-check・static DOM contract・5 route/API 200 | 対象キュー、Mail workspaceのタブ・作業領域をmail-workspace-page.tsへ移動。状態判断・API・client処理は維持 |
| UX-I06 | complete | UX-I03, UX-I04, UX-I05 | 2026-07-12 / uncommitted / 49 suites・146 tests・build・diff-check・client module parse・5 route/API 200 | view-rules.tsへstatus/priority/mail label、sort比較、next action、truncationを分離。DOM/API/stateは維持 |
| UX-I07 | complete | UX-I06 | 2026-07-12 / uncommitted / 50 suites・148 tests・build・diff-check・API failure contract・5 route/Reply API 200 | fetch wrapper、error normalization、data unwrap、operator header設定をapi-client.tsへ移動。endpoint/method/payloadは維持 |
| UX-I08 | complete | UX-I06, UX-I07 | 2026-07-12 / uncommitted / 53 suites・151 tests・build・diff-check・3 render module contract・5 route/API 200 | projects/leads/mailのrender本体をclient moduleへ分離。DOM、state、API、選択/保存処理は維持 |

## 次に実装するタスク

Phase C、Phase E、`UX-D02`、`UX-F01`、`UX-D03`、`UX-F02`、`UX-D04`、`UX-F03`、`UX-D05`、`UX-F04`、`UX-G01`、`UX-G02`、`UX-G03`、`UX-G04`、`UX-G05`、`UX-G06`、`UX-G07`、`UX-G08`、`UX-H01`、`UX-H02`、`UX-H03`、`UX-H04`、`UX-H05`、`UX-I02`、`UX-I03`、`UX-I04`、`UX-I05`、`UX-I06`、`UX-I07`、`UX-I08`は完了。今回のUI/UX分割ロードマップは完了。

## Execution log

モデル選択と切り替えの証跡を記録する。タスクの状態表とは分けて追記する。

| Task | Date | Model | Tier | Reasoning | Event | Reason | Result |
|---|---|---|---|---|---|---|---|
| UX-A01 | 2026-07-12 | GPT-5 | T1 | high | start | dashboard HTML契約テスト追加。現行surfaceではモデル変更せず実行 | complete: cbc7eac |
| UX-A02 | 2026-07-12 | GPT-5 | T1 | high | start | 安定したdata-ui目印追加。現行surfaceではモデル変更せず実行 | complete: 33524e1 |
| UX-A03 | 2026-07-12 | GPT-5 | T1 | high | start | dashboard module README追加。現行surfaceではモデル変更せず実行 | complete: 06f49f0 |
| UX-A04 | 2026-07-12 | GPT-5 | T2 | high | start | mailWorkspaceのreplace依存を廃止。現行surfaceではモデル変更せず実行 | complete: 62d0094 |
| Phase A | 2026-07-12 | GPT-5 current surface | T4 | high | audit | HTML契約、主要DOM、data-ui、既存挙動、全test/buildを再確認 | pass: 29 suites / 90 tests / build OK |
| UX-I01 | 2026-07-12 | GPT-5 current surface | T3 | high | start | 4,000行級controllerの挙動不変分割。ユーザー承認により後続UI作業より先行 | in_progress |
| UX-I01 | 2026-07-12 | GPT-5 current surface | T3 | high | audit | 3画面HTMLの長さ・SHA-256、全test、build、diff-checkを確認 | complete: uncommitted |
| UX-B01 | 2026-07-12 | GPT-5.4 mini | T1 | high | downgrade | Path・DOM・API不変の表示文言だけを分離済みpage rendererで変更 | in_progress |
| UX-B01 | 2026-07-12 | GPT-5 current surface | T1 | high | handoff | 低モデルが一部pageだけ変更後に長時間停止。残る営業案件画面とspecを引き継ぎ | complete: uncommitted / 92 tests / build OK |
| UX-B02 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 1属性のmode分岐とHTML契約テストだけを変更 | in_progress |
| UX-B02 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | URL検索とmail workspaceのdetails属性、dashboard spec、buildを確認 | complete: uncommitted |
| UX-B03 | 2026-07-12 | GPT-5 current surface | T1 | high | start | 2画面の状態classとAPI失敗時表示を限定修正 | in_progress |
| UX-B03 | 2026-07-12 | GPT-5 current surface | T1 | high | audit | 3画面、状態class、API表示、全test、build、実ブラウザ、consoleを確認 | complete: uncommitted |
| Phase B | 2026-07-12 | GPT-5 current surface | T4 | high | audit | 業務用語、検索初期表示、loading/empty/error、既存API・DOM契約を確認 | pass: 92 tests / build / browser OK |
| UX-C01 | 2026-07-12 | GPT-5 current surface | T2 | high | start | メール状態とchecklistに応じた主操作classだけを変更 | in_progress |
| UX-C01 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | draft実dataでaction領域の有効primaryが1つ、補助操作、全test、build、consoleを確認 | complete: uncommitted |
| UX-E00 | 2026-07-12 | GPT-5.6 Terra | T3 | high | start | UI変更なしでLead・Project・Mail・Tracking dataを横断監査 | in_progress |
| UX-E00 | 2026-07-12 | GPT-5 current surface | T3 | high | handoff | 並行エージェントが読み取り途中で停止。API、schema、trackingを直接監査 | complete: docs/24_SALES_LIST_DATA_MAPPING.md |
| UX-C02 | 2026-07-12 | GPT-5 current surface | T2 | high | start | mail page内の既存summaryをsticky barへ拡張 | in_progress |
| UX-E01 | 2026-07-12 | GPT-5.4 mini | T1 | high | downgrade | leads pageだけで既存filterとsummaryを接続 | in_progress |
| UX-E01 | 2026-07-12 | GPT-5 current surface | T1 | high | handoff | 低モデルが変更前に停止。既存filterとの接続、0件表示、解除を引き継ぎ | complete: uncommitted |
| UX-C02 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | desktop sticky、980px以下static、横あふれ、header重なり、consoleを確認 | complete: uncommitted |
| UX-E01 | 2026-07-12 | GPT-5 current surface | T1 | high | audit | 下書き11件、確認待ち0件、解除後56件が一覧件数と一致。empty、consoleを確認 | complete: uncommitted |
| UX-C03 | 2026-07-12 | GPT-5 current surface | T2 | high | start | mail pageのCSS配置と一覧scroll保持だけを変更。API・保存処理は不変 | in_progress |
| UX-E02 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 既存出力controlと関数を維持してdetailsへ移す | in_progress |
| UX-C03 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 1280pxで360px/844pxの2ペイン、56件内部scroll、下方選択後の位置保持、980pxで1列・横あふれなし | complete: uncommitted |
| UX-E02 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 初期折りたたみ、一覧が先、既存scope・format・columns・preview、consoleを確認 | complete: uncommitted |
| UX-C04 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 既存DOMを維持して表示だけ切り替える4タブ。入力値とAPIは不変 | in_progress |
| UX-E03 | 2026-07-12 | GPT-5 current surface | T1 | high | start | data mappingの決定順を純粋表示関数として追加 | in_progress |
| UX-C04 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | draft/未生成の初期タブ、概要・履歴・下書き移動後の未保存入力保持、履歴と返信、consoleを確認 | complete: uncommitted |
| UX-E03 | 2026-07-12 | GPT-5 current surface | T1 | high | audit | 56件で下書き11・連絡先44・既存理由1、並び替え、未取得daysLeftの0誤変換防止、consoleを確認 | complete: uncommitted |
| UX-C05 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 既存filter/sortを再利用して次Leadを選択。未保存時だけ確認 | in_progress |
| UX-E04 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 一覧と詳細の配置、scroll保持、次操作表示だけを変更 | in_progress |
| UX-C05 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 表示順の次へ、scroll保持、未保存確認の取消・承認、一覧末尾、consoleを確認 | complete: uncommitted |
| UX-E04 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 1280px右詳細、1100px下配置、2案件比較時scrollTop 3630維持、URL操作分離、consoleを確認 | complete: uncommitted |
| UX-C06 | 2026-07-12 | GPT-5 current surface | T3 | high | start | editor基準値を一元化し、入力・保存・Lead/Mail移動・beforeunloadを接続 | in_progress |
| UX-C06 | 2026-07-12 | GPT-5 current surface | T3 | high | audit | 保存済み→未保存、Lead移動の取消・承認、入力保持、新mail基準値、beforeunload契約、consoleを確認 | complete: uncommitted |
| UX-D01 | 2026-07-12 | GPT-5 current surface | T2 | high | start | editor右へ既存project dataの比較表示。自動判定とAPI変更なし | in_progress |
| UX-D01 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 1280pxで本文420px・案件情報360px、全項目、980pxで情報が本文上、escape、consoleを確認 | complete: uncommitted |
| UX-D02 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 既存AI outputJsonのfacts/assumptions/riskを未取得と空配列に分けて表示 | in_progress |
| UX-F01 | 2026-07-12 | GPT-5 current surface | T2 | high | start | Lead/mail/replyの既存dataだけでTokyo日付分類を純粋関数化 | in_progress |
| UX-D02 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | /leads-view実dataで根拠・仮定・注意点、risk警告色、model、履歴切り替え、consoleを確認 | complete: uncommitted |
| UX-F01 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | overdue/due_today、Tokyo日付境界、draft/approved/queued/reply/failed、全testを確認 | complete: uncommitted |
| UX-D03 | 2026-07-12 | GPT-5 current surface | T2 | high | start | AI下書きの本文・会社名・案件情報・数値主張・テンプレート変数を決定的に検査 | in_progress |
| UX-F02 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 既存Lead/Mail APIを再利用した今日の営業一覧と既存画面への遷移 | in_progress |
| UX-D03 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 短文、テンプレート変数、会社名、案件キーワード、他社名、数値根拠を検査し、全test・buildを確認 | complete: uncommitted |
| UX-F02 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | `/today`実data56件、7カテゴリ、優先案件20件、カテゴリ/案件遷移、console、全test・buildを確認 | complete: uncommitted |
| UX-D04 | 2026-07-12 | GPT-5 current surface | T2 | high | start | D03の決定的警告をレビュー依頼直前のAPI/UI確認へ接続。既存の状態遷移とAPI契約は維持 | in_progress |
| UX-F03 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 今日の営業・案件・メールの件数を既存dataからナビバッジへ接続。既存画面遷移は維持 | in_progress |
| UX-D04 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 整合性API、実dataの注意2件、確認後遷移、全test・build・browser・consoleを確認 | complete: uncommitted |
| UX-F03 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | `/today`でtoday56・leads56・mail11、3画面nav、全test・build・browser・consoleを確認 | complete: uncommitted |
| UX-D05 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 任意実行のAI意味整合性確認。JSON Schema検証、失敗時のDB不変、人間確認維持を優先 | in_progress |
| UX-F04 | 2026-07-12 | GPT-5 current surface | T2 | high | start | `/`の候補検索を維持し、今日の営業へ入る開始導線だけを追加 | in_progress |
| UX-D05 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 意味整合性domain、UseCase、OpenAI JSON Schema、AI失敗時不変、35 suites・build・browser・consoleを確認 | complete: uncommitted |
| UX-F04 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | `/`のtoday-entry、候補検索維持、mail workspaceの任意ボタン、35 suites・build・browser・consoleを確認 | complete: uncommitted |
| UX-G01 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 現行EmailReply、Mail、Lead、Company、Contact、Project、Gmail thread APIを読み取り、未実装APIを設計 | in_progress |
| UX-G01 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 現行schema/codeと旧docsの差分、GET API、DTO、filter、pagination、安全フラグを`docs/25_REPLY_INBOX_API_DESIGN.md`へ固定 | complete: uncommitted |
| UX-G02 | 2026-07-12 | GPT-5 current surface | T2 | high | start | ReplyCategoryをDBなしの表示カテゴリ・優先度・manager確認・追客停止フラグへ変換 | in_progress |
| UX-G02 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 8カテゴリ、unsubscribe/complaintの優先度、会社NG・Contact配信停止、未知分類、本文短縮を単体テストで確認 | complete: uncommitted |
| UX-G03 | 2026-07-12 | GPT-5 current surface | T2 | high | start | EmailReply起点でMail・Lead・Company・Contact・Projectだけを取得し、query条件をrepositoryへ限定 | in_progress |
| UX-G03 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | 100件上限、filter、日時/信頼度/優先度sort、安全条件、同一reply重複なしをrepository spec・全test・buildで確認 | complete: uncommitted |
| UX-G04 | 2026-07-12 | GPT-5 current surface | T2 | high | start | Reply Inbox DTO、UseCase、Controllerをrepositoryへ接続し、docs/06_API.mdとOpenAPIを同時更新 | in_progress |
| UX-G04 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | `/api/replies`実data 200、manager filter 200、不正limit 400、39 suites・build・diff-checkを確認 | complete: uncommitted |
| UX-G05 | 2026-07-12 | GPT-5 current surface | T2 | high | start | G04のReply Inbox APIを専用rendererへ接続し、既存ナビから返信対応画面へ導線を追加 | in_progress |
| UX-G05 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | `/replies`画面、空状態、manager確認/追客停止表示、filter、API衝突回避、39 suites・126 tests・build・browser・consoleを確認 | complete: uncommitted |
| UX-G06 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 次回対応を既存Lead更新で表現できるか、Task modelが必要か、返信後の期限と担当の不足を読み取り調査 | in_progress |
| UX-G06 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | `docs/26_NEXT_ACTION_DESIGN.md`へTask正本、状態遷移、API案、UTC/Asia-Tokyo、既存Lead互換、DB変更なしの判断を記録。39 suites・126 tests・build・diff-checkを維持確認 | complete: uncommitted |
| UX-G07 | 2026-07-12 | GPT-5 current surface | T3 | high | start | 既存Task modelを使い、状態遷移、Task API、担当候補、LeadのnextTask summaryを追加。schema/migrationは変更しない | in_progress |
| UX-G07 | 2026-07-12 | GPT-5 current surface | T3 | high | audit | Task domain policy、repository port、4 API、Lead summary、UUID/DTO検証、API実data、44 suites・136 tests・build・diff-checkを確認 | complete: uncommitted |
| UX-G08 | 2026-07-12 | GPT-5 current surface | T2 | high | start | 既存lead detailとtodayのdata-uiを維持し、Task APIの入力、一覧、保存状態、東京時間の期限表示を追加 | in_progress |
| UX-G08 | 2026-07-12 | GPT-5 current surface | T2 | high | audit | Lead詳細のTask UI、Task API再取得、今日の営業の`nextTask`優先、全inline script parse、44 suites・136 tests・build・diff-checkを確認 | complete: uncommitted |
| UX-H01 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 既存の配色・DOM・操作高さを維持し、4つのdashboard rendererへ共通CSS tokenを追加 | in_progress |
| UX-H01 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 4 rendererのCSS token、dashboard契約、44 suites・136 tests・build・diff-checkを確認。既存の主要色・DOM・レイアウトは維持 | complete: uncommitted |
| UX-H02 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | focus-visibleを共通追加し、Lead/Mailの行選択をEnter/Spaceで実行できるようにする | in_progress |
| UX-H02 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 4 rendererのfocus-visible、Lead/Mail行のtabindex/Enter/Space handler、44 suites・136 tests・build・diff-checkを確認 | complete: uncommitted |
| UX-H03 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 既存labelとDOMを維持し、画面状態・Task保存状態・件数更新をaria-liveで通知 | in_progress |
| UX-H03 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 4 rendererのaria-live通知、既存label/DOM/API維持、44 suites・136 tests・build・diff-checkを確認 | complete: uncommitted |
| UX-H04 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 1440/1024/390幅のbreakpoint、表の局所scroll、sticky解除、主操作の折返しをCSSとHTMLで監査 | in_progress |
| UX-H04 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 4 rendererのbreakpoint、390px header、table/queue局所overflow、44 suites・136 tests・build・diff-checkを確認 | complete: uncommitted |
| UX-H05 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | API paginationを変えず、Lead一覧だけ20件client pagingにしてfilter/sort/selected leadを維持する | in_progress |
| UX-H05 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | Lead一覧の20件client paging、filter/sort/selected lead維持、4画面HTML script parse、全test、build、diff-check、API 200を確認 | complete: uncommitted |
| UX-I02 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 4rendererのCSSをshared-styles.tsへ移し、selectorと出力順を変えない | in_progress |
| UX-I02 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 4rendererのshared style埋め込み、45 suites・140 tests・build・diff-check、4画面CSS/script parse、API 200を確認 | complete: uncommitted |
| UX-I03 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 候補検索・候補URL一覧の静的HTMLだけをurl-search-page.tsへ移し、client関数を残す | in_progress |
| UX-I03 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | URL検索/メール作業モードのstatic DOM contract、46 suites・141 tests・build・diff-check、5 route/API 200を確認 | complete: uncommitted |
| UX-I04 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | Lead一覧の静的HTMLをleads-page-static.tsへ移し、client処理を残す | in_progress |
| UX-I04 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | Lead static DOM contract、47 suites・142 tests・build・diff-check、`/leads-view` 200を確認 | complete: uncommitted |
| UX-I05 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | 対象キュー、Mail workspaceのタブ・作業領域だけをmail-workspace-page.tsへ移し、状態判断を残す | in_progress |
| UX-I05 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | Mail static DOM contract、48 suites・143 tests・build・diff-check、5 route/API 200、主要Mail DOMを確認 | complete: uncommitted |
| UX-I06 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | status/priority/next action/sort/textの純粋判定だけをclient moduleへ寄せ、DOM/API/stateを残す | in_progress |
| UX-I06 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | view-rules pure tests、client script parse、49 suites・146 tests・build・diff-check、5 route/API 200、主要DOMを確認 | complete: uncommitted |
| UX-I07 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | fetch wrapperとerror normalizationだけをclient moduleへ移し、endpoint/method/payloadを維持 | in_progress |
| UX-I07 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | API client failure contract、50 suites・148 tests・build・diff-check、5 route/Reply API 200、Today/Replies注入を確認 | complete: uncommitted |
| UX-I08 | 2026-07-12 | GPT-5 current surface | T1 | medium | start | projects、leads、mailのrender領域を1つずつclient moduleへ移し、state/API/DOMを維持 | in_progress |
| UX-I08 | 2026-07-12 | GPT-5 current surface | T1 | medium | audit | 3 render module contract、53 suites・151 tests・build・diff-check、3主要DOM、5 route/API 200を確認 | complete: uncommitted |
| Phase C | 2026-07-12 | GPT-5 current surface | T4 | high | audit | 主操作、sticky context、2ペイン、4タブ、次案件、未保存検知を実dataで通し確認 | pass: 92 tests / build / browser OK |
| Phase E | 2026-07-12 | GPT-5 current surface | T4 | high | audit | data mapping、summary filter、補助出力、対応理由、右詳細を実dataで通し確認 | pass: 92 tests / build / browser OK |

Event:

- `start`: タスク開始時のモデル選択
- `upgrade`: 強いモデルへ変更
- `downgrade`: 次の独立タスクから小さいモデルへ変更
- `audit`: Phase監査
- `handoff`: 現在のsurfaceでモデル変更できず引き継ぎ
