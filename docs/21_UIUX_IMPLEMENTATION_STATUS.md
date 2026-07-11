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
| UX-D05 | pending | UX-D03, UX-D04 | - | 任意のAI意味整合性確認 |
| UX-E00 | complete | UX-B03 | 2026-07-12 / uncommitted / `docs/24_SALES_LIST_DATA_MAPPING.md` | 既存data、fallback、返信・資料閲覧のAPI不足、共通mappingを固定 |
| UX-E01 | complete | UX-B01, UX-B02, UX-B03, UX-E00 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | summary cardから既存filterへ絞り込み |
| UX-E02 | complete | UX-E01 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | CSV/TSV出力を折りたたみの補助操作へ移す |
| UX-E03 | complete | UX-E00 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | 既存dataだけで今対応する理由を表示 |
| UX-E04 | complete | UX-E01 | 2026-07-12 / uncommitted / 30 suites・92 tests・build・browser OK | desktop右詳細・mobile下配置・一覧位置保持 |
| UX-F01 | complete | UX-E00 | 2026-07-12 / uncommitted / 31 suites・95 tests・build OK | 今日の営業分類をdomain純粋関数へ追加 |
| UX-F02 | complete | UX-F01, UX-A04 | 2026-07-12 / uncommitted / 32 suites・101 tests・build・browser OK | /today画面 |
| UX-F03 | complete | UX-F02 | 2026-07-12 / uncommitted / 33 suites・103 tests・build・browser OK | ナビ件数バッジ |
| UX-F04 | pending | UX-F02, UX-F03 | - | today初期導線 |
| UX-G01 | pending | - | - | Reply API差分調査 |
| UX-G02 | pending | UX-G01 | - | Reply view model |
| UX-G03 | pending | UX-G01, UX-G02 | - | Reply repository query |
| UX-G04 | pending | UX-G02, UX-G03 | - | Reply API usecase/controller |
| UX-G05 | pending | UX-G04 | - | /replies画面 |
| UX-G06 | pending | UX-G05 | - | 次回対応差分調査 |
| UX-G07 | pending | UX-G06 | - | 次回対応backend |
| UX-G08 | pending | UX-G07 | - | 次回対応UI |
| UX-H01 | pending | UX-C06, UX-D04, UX-E04, UX-F04, UX-G08 | - | デザイントークン |
| UX-H02 | pending | UX-H01 | - | keyboard/focus |
| UX-H03 | pending | UX-H01 | - | label/accessibility |
| UX-H04 | pending | UX-H01 | - | 3幅responsive |
| UX-H05 | pending | UX-C03, UX-E04 | - | 描画量削減 |
| UX-I01 | complete | UX-A04 | 2026-07-12 / uncommitted / 30 suites・92 tests・build OK / 3画面SHA-256一致 | controller 4,297行→24行、page rendererとshellを分離 |
| UX-I02 | pending | UX-I01, UX-H01 | - | CSS分離 |
| UX-I03 | pending | UX-I02 | - | URL検索HTML分離 |
| UX-I04 | pending | UX-I02 | - | Lead一覧HTML分離 |
| UX-I05 | pending | UX-I02 | - | Mail HTML分離 |
| UX-I06 | pending | UX-I03, UX-I04, UX-I05 | - | 純粋表示判定分離 |
| UX-I07 | pending | UX-I06 | - | API client分離 |
| UX-I08 | pending | UX-I06, UX-I07 | - | render領域分離 |

## 次に実装するタスク

Phase C、Phase E、`UX-D02`、`UX-F01`、`UX-D03`、`UX-F02`、`UX-D04`、`UX-F03`は完了。次は`UX-D05`（任意のAI意味整合性確認）と`UX-F04`（today初期導線）を進める。

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
| Phase C | 2026-07-12 | GPT-5 current surface | T4 | high | audit | 主操作、sticky context、2ペイン、4タブ、次案件、未保存検知を実dataで通し確認 | pass: 92 tests / build / browser OK |
| Phase E | 2026-07-12 | GPT-5 current surface | T4 | high | audit | data mapping、summary filter、補助出力、対応理由、右詳細を実dataで通し確認 | pass: 92 tests / build / browser OK |

Event:

- `start`: タスク開始時のモデル選択
- `upgrade`: 強いモデルへ変更
- `downgrade`: 次の独立タスクから小さいモデルへ変更
- `audit`: Phase監査
- `handoff`: 現在のsurfaceでモデル変更できず引き継ぎ
