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
| UX-A04 | complete | UX-A01, UX-A02 | 2026-07-12 / uncommitted / npm test -- --runInBand OK / npm run build OK | mailWorkspace文字列置換廃止 |
| UX-B01 | pending | UX-A04 | - | 業務用語へ統一 |
| UX-B02 | pending | UX-B01 | - | 検索フォーム初期表示 |
| UX-B03 | pending | UX-B01 | - | loading/empty/error |
| UX-C01 | pending | UX-B03 | - | 主操作を1つにする |
| UX-C02 | pending | UX-C01 | - | 選択案件固定バー |
| UX-C03 | pending | UX-C02 | - | 2ペイン化 |
| UX-C04 | pending | UX-C03 | - | 作業領域4タブ |
| UX-C05 | pending | UX-C03 | - | 次の案件へ |
| UX-C06 | pending | UX-C04, UX-C05 | - | 未保存変更検知 |
| UX-D01 | pending | UX-C03 | - | 本文横の案件情報 |
| UX-D02 | pending | UX-D01 | - | AI根拠・仮定・リスク |
| UX-D03 | pending | UX-D01, UX-D02 | - | 決定的整合性チェック |
| UX-D04 | pending | UX-D03 | - | レビュー前警告 |
| UX-D05 | pending | UX-D03, UX-D04 | - | 任意のAI意味整合性確認 |
| UX-E00 | pending | UX-B03 | - | 一覧判断data監査 |
| UX-E01 | pending | UX-B01, UX-B02, UX-B03, UX-E00 | - | 状態サマリー絞り込み |
| UX-E02 | pending | UX-E01 | - | 出力を補助メニューへ |
| UX-E03 | pending | UX-E00 | - | 今対応する理由 |
| UX-E04 | pending | UX-E01 | - | 案件詳細右パネル |
| UX-F01 | pending | UX-E00 | - | 今日の営業分類 |
| UX-F02 | pending | UX-F01, UX-A04 | - | /today画面 |
| UX-F03 | pending | UX-F02 | - | ナビ件数バッジ |
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
| UX-I01 | pending | UX-A04 | - | page mode/shell分離 |
| UX-I02 | pending | UX-I01, UX-H01 | - | CSS分離 |
| UX-I03 | pending | UX-I02 | - | URL検索HTML分離 |
| UX-I04 | pending | UX-I02 | - | Lead一覧HTML分離 |
| UX-I05 | pending | UX-I02 | - | Mail HTML分離 |
| UX-I06 | pending | UX-I03, UX-I04, UX-I05 | - | 純粋表示判定分離 |
| UX-I07 | pending | UX-I06 | - | API client分離 |
| UX-I08 | pending | UX-I06, UX-I07 | - | render領域分離 |

## 次に実装するタスク

初期状態では `UX-A01`。以後は、依存関係がすべて `complete` になっている最上段の `pending` を1つ選ぶ。

## Execution log

モデル選択と切り替えの証跡を記録する。タスクの状態表とは分けて追記する。

| Task | Date | Model | Tier | Reasoning | Event | Reason | Result |
|---|---|---|---|---|---|---|---|
| UX-A01 | 2026-07-12 | GPT-5 | T1 | high | start | dashboard HTML契約テスト追加。現行surfaceではモデル変更せず実行 | complete: cbc7eac |
| UX-A02 | 2026-07-12 | GPT-5 | T1 | high | start | 安定したdata-ui目印追加。現行surfaceではモデル変更せず実行 | complete: 33524e1 |
| UX-A03 | 2026-07-12 | GPT-5 | T1 | high | start | dashboard module README追加。現行surfaceではモデル変更せず実行 | complete: 06f49f0 |
| UX-A04 | 2026-07-12 | GPT-5 | T2 | high | start | mailWorkspaceのreplace依存を廃止。現行surfaceではモデル変更せず実行 | complete: uncommitted |

Event:

- `start`: タスク開始時のモデル選択
- `upgrade`: 強いモデルへ変更
- `downgrade`: 次の独立タスクから小さいモデルへ変更
- `audit`: Phase監査
- `handoff`: 現在のsurfaceでモデル変更できず引き継ぎ
