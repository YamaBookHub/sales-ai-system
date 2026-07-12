# dashboard module

営業AI支援ツールのローカル業務画面を返すmodule。

controllerはルーティング専用に分離済み。HTML、CSS、JavaScriptはまだページ生成ファイル内に同居しているため、分割が完了するまでは1回の作業で1目的だけ変更する。

## 現在の構造

```text
dashboard/
  dashboard.controller.ts       # URLとページrenderer呼び出しだけ
  dashboard.controller.spec.ts  # 3画面のHTML契約
  ui/
    dashboard-page-mode.ts      # 候補探し / 作成・レビューのmode
    shared-shell.ts             # body、見出し、active nav
    dashboard-page.ts           # URL検索 / メール作成の既存HTML
    leads-page.ts               # 営業リストの既存HTML
    replies-page.ts             # 返信対応の一覧HTML
```

表示変更は `dashboard.controller.ts` ではなく、対象の `ui/*-page.ts` で行う。

## 画面

| URL | Method | 役割 |
|---|---|---|
| `/` | `DashboardController.index()` | 候補探し、取り込み、営業対象一覧、案件詳細、AI分析、メール確認 |
| `/leads-view` | `DashboardController.leadsView()` | 営業案件の一覧、詳細、分析、出力 |
| `/mail-workspace` | `DashboardController.mailWorkspace()` | 作成・レビュー、履歴、本文編集、チェック、承認 |
| `/replies` | `main.ts` の画面公開ルート | 返信一覧、分類、manager確認、追客停止 |

`/replies` と `GET /api/replies` は同じGET名になるため、APIプレフィックスの除外には追加せず、画面だけをHTTPアダプタの公開ルートから `ui/replies-page.ts` へ接続する。これにより画面URLと既存API URLを同時に維持する。

URLは変更しない。既存APIのURL、リクエスト、レスポンスも変更しない。

## 安定したUI目印

行番号やCSS階層ではなく、次の `data-ui` を検索して変更場所を特定する。

| 目印 | 対象 |
|---|---|
| `data-ui-page="url-search"` | 候補を探す画面 |
| `data-ui-page="leads"` | 営業リスト画面 |
| `data-ui-page="mail-workspace"` | 作成・レビュー画面 |
| `data-ui-page="replies"` | 返信対応画面 |
| `data-ui="top-nav"` | 画面上部ナビゲーション |
| `data-ui="candidate-search"` | 候補検索、URL直接取り込み |
| `data-ui="lead-list-workspace"` | 営業リストの一覧と詳細 |
| `data-ui="lead-attention-reason"` | 各営業案件を今対応する理由 |
| `data-ui="lead-detail-panel"` | 営業リスト右側の選択案件詳細 |
| `data-ui="lead-export-tools"` | 営業リストのCSV / TSV補助出力 |
| `data-ui="mail-lead-queue"` | 作成・レビュー画面の営業対象一覧 |
| `data-ui="mail-focus-workspace"` | メール作成、履歴、本文、チェックの作業領域 |
| `data-ui="mail-lead-summary"` | 選択中の営業対象サマリー |
| `data-ui="mail-context-bar"` | 選択中の会社、メール状態、チェック状況、次操作 |
| `data-mail-work-tab` / `data-mail-work-panel` | 概要、下書き、チェック・承認、履歴の切り替え |
| `data-ui="mail-history"` | メール作成履歴 |
| `data-ui="mail-draft-editor"` | 件名、本文編集 |
| `data-ui="mail-project-comparison"` | 本文横で見比べる会社・案件・支援情報 |
| `data-ui="mail-review-panel"` | 送信前チェック、レビュー、承認 |
| `data-ui="reply-inbox"` / `data-ui="reply-filters"` / `data-ui="reply-list"` | 返信対応の一覧、条件、結果 |

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
- `nextLeadButton`
- `mailEditorSaveState`
- `detailNextAction`
- `summaryFilterStatus`
- `clearSummaryFilterButton`

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
