# dashboard module

営業AI支援ツールのローカル業務画面を返すmodule。

このmoduleは一時的にHTML、CSS、JavaScriptが `dashboard.controller.ts` に同居している。分割が完了するまでは、1回の作業で1目的だけ変更する。

## 画面

| URL | Method | 役割 |
|---|---|---|
| `/` | `DashboardController.index()` | URL検索、候補表示、取り込み、営業対象一覧、案件詳細、無料分析、メール確認 |
| `/leads-view` | `DashboardController.leadsView()` | 営業リストの一覧、詳細、分析、出力 |
| `/mail-workspace` | `DashboardController.mailWorkspace()` | メール作成、履歴、本文編集、チェック、レビュー |

URLは変更しない。既存APIのURL、リクエスト、レスポンスも変更しない。

## 安定したUI目印

行番号やCSS階層ではなく、次の `data-ui` を検索して変更場所を特定する。

| 目印 | 対象 |
|---|---|
| `data-ui-page="url-search"` | URL検索画面 |
| `data-ui-page="leads"` | 営業リスト画面 |
| `data-ui-page="mail-workspace"` | メール作成画面 |
| `data-ui="top-nav"` | 画面上部ナビゲーション |
| `data-ui="candidate-search"` | 候補検索、URL直接取り込み |
| `data-ui="lead-list-workspace"` | 営業リストの一覧と詳細 |
| `data-ui="mail-lead-queue"` | メール作成画面の営業対象一覧 |
| `data-ui="mail-focus-workspace"` | メール作成、履歴、本文、チェックの作業領域 |
| `data-ui="mail-lead-summary"` | 選択中の営業対象サマリー |
| `data-ui="mail-history"` | メール作成履歴 |
| `data-ui="mail-draft-editor"` | 件名、本文編集 |
| `data-ui="mail-review-panel"` | 送信前チェック、レビュー、承認 |

## 主要DOM ID

既存のIDは変更しない。JavaScriptとテストが依存している。

- `leadRows`
- `leadDetail`
- `leadAnalysis`
- `campfireCandidates`
- `mailLeadSummary`
- `templateKey`
- `generateButton`
- `mailRows`
- `subject`
- `body`
- `checklistRows`
- `reviewButton`
- `rejectButton`
- `approveButton`
- `queueButton`

## メール安全ルール

dashboardの表示変更でも、次の業務ルールを壊してはいけない。

- AI生成メールは `draft` 保存まで。
- `approved` 以外のメールを `queued` にしない。
- checklist未完了のメールを承認、queueしない。
- 棄却はレビュー依頼後または承認後のメールだけで使う。
- 自動送信はしない。
- 既存メールの状態遷移APIを勝手に変えない。

## 変更手順

1. `docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md` から対象タスクIDを1つ選ぶ。
2. `docs/21_UIUX_IMPLEMENTATION_STATUS.md` を `in_progress` にし、Execution logへモデル選択を記録する。
3. `data-ui` または主要IDで変更場所を検索する。
4. API、DB、domain、mail状態遷移には触らない。
5. `apps/api/src/dashboard/dashboard.controller.spec.ts` を更新する。
6. `npm test -- --runInBand` と `npm run build` を実行する。
7. 成功後だけ進捗表を `complete` にする。

## 禁止

- React、Vueなどの新しいfrontend frameworkを導入しない。
- 画面改善と構造分割を同時に行わない。
- CSS分離、JavaScript分離、HTML分離を1回でまとめない。
- 既存ID、主要class、`data-ui` を削除しない。
- `git reset`、`git checkout` で既存変更を戻さない。
