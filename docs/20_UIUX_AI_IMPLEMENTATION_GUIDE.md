# 20_UIUX_AI_IMPLEMENTATION_GUIDE

## 0. この文書の目的

この文書は、性能の低いAIモデルでも営業画面のUI/UXを最終形まで段階的に改善できるようにする実装指示書である。

1回の作業で全面改修は行わない。必ずこの文書のタスクIDを1つだけ指定し、編集範囲、禁止事項、受け入れ条件、確認手順を守る。

設計の正本:

- 業務原則: `docs/00_CHARTER.md`
- UI仕様: `docs/05_UI.md`
- AIが修正しやすい構造: `docs/18_AI_MAINTAINABLE_ARCHITECTURE.md`
- 現在地と安全制約: `docs/19_LOW_MODEL_HANDOFF.md`
- UI/UXの実装順序: この文書

## 1. 最終目標

営業担当者が次の流れを迷わず完了できること。

```text
今日やる案件を知る
  -> 1件を選ぶ
  -> 案件情報とAI下書きを見比べる
  -> 必要なら修正する
  -> 送信前チェックを完了する
  -> レビュー・承認・キュー投入を安全に進める
  -> 返信または次回対応を記録する
  -> 次の案件へ進む
```

UI/UXの中心原則:

> 次に処理する1件を選び、安全に完了し、そのまま次の1件へ進める。

## 2. 現在の画面と確認済み課題

現在の画面:

| Path | controller method | 現在の役割 |
|---|---|---|
| `/` | `index()` | URL検索、候補検索、取り込み |
| `/leads-view` | `leadsView()` | 営業リスト、詳細、CSV/TSV出力 |
| `/mail-workspace` | `mailWorkspace()` | 対象選択、下書き、チェック、承認、返信メモ |

実画面で確認済みの主な課題:

1. `/` の初期状態では検索フォームが閉じ、画面の大部分が空白になる。
2. `/mail-workspace` は対象一覧から返信メモまで約3.5画面分の高さがある。
3. 56件の対象一覧と、1件の本文編集・承認作業が同じ縦方向に積まれている。
4. 保存、レビュー依頼、再レビュー、棄却、承認、キュー投入などが同じ強さで並ぶ。
5. 選択案件がスモークサーモンでも、本文に「お米の鮮度」「キッチン収納」という別商品の説明が残る事例があり、誤生成を発見しにくい。
6. 点数0、優先度「中」が多く、一覧だけでは次に対応すべき案件を判断しにくい。
7. `URL検索`、`メール作成`、`無料メール生成` など、機能中心の名称が残っている。

## 3. 絶対に守る業務ルール

次のルールはUI変更によって弱めてはならない。

1. AI生成メールは必ず `draft` 保存までとし、自動送信しない。
2. `approved` 以外のメールを `queued` にしない。
3. checklist未完了のメールを承認・queueしない。
4. 同じleadに重複メールを作らない。
5. OpenAI失敗時に既存メールやlead状態を更新しない。
6. OpenAI出力を検証せずDBへ保存しない。
7. 配信停止、会社NG、苦情を無視する導線を作らない。
8. 既存API path、payload、enum値を表示変更だけのタスクで変えない。
9. ユーザー入力や外部取得値をHTMLへ入れる場合は `escapeHtml()` または `escapeAttr()` を通す。
10. 実送信の確認作業では `MAIL_SEND_ENABLED` を有効にしない。

上記を変える必要がある場合はUIタスクを停止し、対象moduleのdomainルール、テスト、API仕様を別タスクとして先に変更する。

## 4. 低いモデルが守る作業方法

### 4.1 開始前

高性能モデルが全体計画や節目監査を行う場合は、この文書を全文読む。

低いモデルが指定済みの1タスクを実装する場合は、長い将来計画をすべて読み込まず、次だけを読む。

1. `AGENTS.md`
2. `docs/19_LOW_MODEL_HANDOFF.md`
3. `docs/21_UIUX_IMPLEMENTATION_STATUS.md`
4. `docs/23_UIUX_MODEL_ROUTING_POLICY.md`
5. この文書のSection 0〜6
6. 指定されたタスクIDの節だけ
7. この文書のSection 12
8. 変更対象moduleのREADME
9. 変更対象の既存テスト

タスクIDを指定されていない場合は実装しない。進捗表から依存関係を満たした最小の未完了タスクを1つ提案して止まる。

### 4.2 1回の変更範囲

- この文書のタスクIDを1つだけ実装する。
- 「ついでの改善」をしない。
- 許可されたファイル以外を変更しない。
- フォーマッターによるファイル全体の機械的変更をしない。
- タスク外の既存不具合を見つけた場合は修正せず、報告だけする。
- 既存の未コミット変更を削除、巻き戻し、上書きしない。

タスク節に許可ファイルが書かれていない場合は、次の既定範囲を使う。既定範囲を超える必要があれば停止する。

| Task | 既定の変更許可範囲 |
|---|---|
| dashboard表示だけ | `apps/api/src/dashboard/` の対象ファイル、関連spec、`docs/05_UI.md`、進捗表 |
| `leads` の純粋判断 | `apps/api/src/leads/domain/` の対象ファイルとspec、関連README、進捗表 |
| `ai` の純粋判断 | `apps/api/src/ai/domain/` の対象ファイルとspec、関連README、進捗表 |
| `mail` の返信判断 | `apps/api/src/mail/domain/` の対象ファイルとspec、関連README、進捗表 |
| API追加 | 対象moduleのcontroller、dto、application、infrastructure、spec、`docs/06_API.md`、`openapi/openapi.yaml`、進捗表 |
| DB変更 | 対象schema、1 migration、repository、spec、`docs/07_DATABASE.md`、進捗表 |
| 調査だけ | 指定された調査文書と進捗表。実装コードは変更しない |

複数行にまたがる種類、特にAPI追加とDB変更を同じタスクで行わない。タスク節に明示された範囲がこの表より狭い場合は、狭い方を優先する。

### 4.3 変更場所の探し方

行番号は使わない。行番号は変更のたびにずれる。次のmethod、DOM id、表示文字列を `rg` で検索する。

| 領域 | 検索語 |
|---|---|
| Lead一覧ページ | `leadsView()` |
| URL検索・共通ページ | `index()` |
| メール専用表示 | `mailWorkspace()` |
| 全データ読み込み | `loadAll()` |
| 候補検索 | `searchCampfireCandidates()` |
| 候補検索結果 | `renderCampfireCandidates()` |
| 営業対象一覧 | `renderLeads()`、`leadRows` |
| 対象選択 | `selectLead()`、`selectLeadFromButton()` |
| 選択案件概要 | `renderMailLeadSummary()`、`mailLeadSummary` |
| 案件詳細 | `renderLeadDetail()`、`leadDetail` |
| AI分析 | `renderAiAnalysis()`、`aiAnalysis` |
| メール生成 | `generateMail()`、`generateButton` |
| メール履歴 | `renderMails()`、`mailRows` |
| メール選択 | `selectMail()` |
| 本文保存 | `saveMail()`、`mailSubject`、`mailBody` |
| チェックリスト | `renderChecklist()`、`mailChecklist` |
| 次操作表示 | `renderMailStageCards()`、`mailNextAction` |
| レビュー依頼 | `requestReview()`、`reviewButton` |
| 承認 | `approveMail()`、`approveButton` |
| キュー投入 | `queueMail()`、`queueButton` |

### 4.4 完了時

最低限、次を実行する。

```bash
npm run build
npm test -- --runInBand
```

UIを変更した場合は、API起動後に次をブラウザで確認する。

```text
http://localhost:3000/
http://localhost:3000/leads-view
http://localhost:3000/mail-workspace
```

確認結果には次を含める。

- 実装したタスクID
- 変更ファイル
- 変えなかった業務ルール
- build結果
- test結果
- ブラウザ確認したPath
- 残課題

すべて成功した後だけ `docs/21_UIUX_IMPLEMENTATION_STATUS.md` の対象タスクを `complete` に変更し、commit hashまたは変更確認日を記録する。buildまたはtestが失敗した場合は `in_progress` のまま、失敗理由を記録する。

## 5. 目標とする情報設計

最終的な上部ナビゲーション:

1. 今日の営業
2. 候補を探す
3. 営業案件
4. レビュー・送信
5. 設定

MVP中は既存Pathを維持し、段階的に名称と画面責務を近づける。

最終的なメール作業画面:

```text
┌─────────────────────────────────────────────────────────────┐
│ 会社名 / 状態 / 次操作                         [主操作ボタン] │
├──────────────────┬──────────────────────────────────────────┤
│ 営業対象キュー     │ 概要 | 下書き | チェック・承認 | 履歴       │
│                  │                                          │
│ ● 選択中の案件     │ 本文編集             案件情報と見比べる     │
│   次: 本文確認     │                      会社名 / 案件名         │
│                  │                      facts / assumptions  │
│ ○ 次の案件        │                      risk flags          │
│                  │                                          │
│ ○ 次の案件        │                         [保存] [主操作]    │
├──────────────────┴──────────────────────────────────────────┤
│ 本日の進捗 / 完了件数                              [次の案件] │
└─────────────────────────────────────────────────────────────┘
```

## 6. 状態ごとの主操作

表示上の主操作は1つだけ強調する。APIの状態遷移条件は変更しない。

| Mail status | 主操作 | 前提 |
|---|---|---|
| メールなし | AI下書きを生成 | Lead選択済み |
| `draft` | レビュー依頼 | 本文保存済み |
| `rejected` | 再レビュー依頼 | 本文修正・保存済み |
| `in_review` | 承認 | checklist完了 |
| `approved` | 送信待ちにする | checklist完了 |
| `queued` | 状態確認 | UIから自動送信しない |
| `sending` | 状態確認 | 二重操作させない |
| `sent` | 返信を記録 | 返信がある場合 |
| `failed` | 再試行の確認 | 既存mail policyに従う |
| `cancelled` | 履歴確認 | 新しい遷移をUIだけで作らない |

棄却、キャンセル、手動で送信済みにする操作は補助操作または「その他」に置き、主操作と同じ強さにしない。

## 7. 実装ロードマップ

各Phaseは上から順に行う。各タスクは1回のAI依頼として独立させる。

---

## Phase A: 変更を壊れにくくする

### UX-A01: dashboardのHTML契約テストを追加する

目的: 低いモデルが画面の入口や主要DOMを消した時にテストで検知する。

変更してよいファイル:

- `apps/api/src/dashboard/dashboard.controller.spec.ts` 新規

実装内容:

- `DashboardController` を直接生成する。
- `index()` がURL検索ページの主要idを含むことを確認する。
- `leadsView()` がLead一覧と詳細領域の主要idを含むことを確認する。
- `mailWorkspace()` がメール画面用body class、見出し、主要idを含むことを確認する。
- 全文snapshotは使わない。変更してはいけない入口だけを個別にassertする。

受け入れ条件:

- DBなしでテストできる。
- 文言の小変更で大量のテスト修正が発生しない。
- `/`、`/leads-view`、`/mail-workspace` の契約を個別に確認する。

### UX-A02: 安定したUI目印を追加する

依存: UX-A01

目的: 行番号や壊れやすいCSS階層を使わず変更場所を特定する。

変更してよいファイル:

- `apps/api/src/dashboard/dashboard.controller.ts`
- `apps/api/src/dashboard/dashboard.controller.spec.ts`

実装内容:

次の属性を追加する。既存id、class、挙動は変えない。

```text
data-ui-page="url-search"
data-ui-page="leads"
data-ui-page="mail-workspace"
data-ui="top-nav"
data-ui="candidate-search"
data-ui="lead-list-workspace"
data-ui="mail-lead-queue"
data-ui="mail-focus-workspace"
data-ui="mail-lead-summary"
data-ui="mail-history"
data-ui="mail-draft-editor"
data-ui="mail-review-panel"
```

受け入れ条件:

- 見た目とAPI呼び出しが変わらない。
- UX-A01のテストが新しい目印を確認する。

### UX-A03: dashboard module READMEを追加する

依存: UX-A02

変更してよいファイル:

- `apps/api/src/dashboard/README.md` 新規

実装内容:

- 3画面のPathとmethodを書く。
- 上記 `data-ui` と主要render関数の対応表を書く。
- 絶対に変えないメール安全ルールを書く。
- 1回に1タスクだけ変更する手順を書く。

受け入れ条件:

- 次のモデルがcontroller全体を読まなくても、変更場所を検索できる。

### UX-A04: `mailWorkspace()` の文字列置換依存をなくす

依存: UX-A01、UX-A02

目的: 見出しやbodyを変更しただけでメール画面が壊れる構造をなくす。

変更してよいファイル:

- `apps/api/src/dashboard/dashboard.controller.ts`
- `apps/api/src/dashboard/dashboard.controller.spec.ts`

実装内容:

- 共通HTML生成へ `pageMode: 'url-search' | 'mail-workspace'` を渡す。
- body class、h1、active navをmodeから直接生成する。
- `.replace()` による画面切り替えを削除する。
- 生成されるDOM id、API呼び出し、表示機能は変えない。

受け入れ条件:

- 変更前後の3画面で主要DOM契約が同じ。
- `mailWorkspace()` 内にHTML `.replace()` が残らない。

停止条件:

- 出力HTMLを同じに保てない場合は、全面テンプレート分割へ進まず作業を止める。

---

## Phase B: 言葉と最初の操作を整える

### UX-B01: 画面名称を業務用語へ統一する

依存: UX-A04

変更内容:

- `URL検索` → `候補を探す`
- `営業リスト` → `営業案件`
- `メール作成` → `作成・レビュー`
- `無料メール生成` → `AI下書きを生成`
- `無料分析` → `AI分析`

変更してよいファイル:

- `apps/api/src/dashboard/ui/dashboard-page.ts`
- `apps/api/src/dashboard/ui/leads-page.ts`
- `apps/api/src/dashboard/ui/shared-shell.ts`
- `apps/api/src/dashboard/dashboard.controller.spec.ts`
- `docs/05_UI.md`

禁止:

- Path、関数名、DOM id、API pathを変えない。

受け入れ条件:

- 3画面のナビゲーション文言が一致する。
- 営業画面に用途不明な「無料」という文言が残らない。

### UX-B02: 未検索時の検索フォームを開く

依存: UX-B01

目的: 最初に何をすればよいか見せる。

変更内容:

- `/` では候補検索detailsを初期表示で開く。
- `/mail-workspace` では候補検索領域を表示しない現状を守る。
- 自動開閉ロジックは追加しない。

受け入れ条件:

- `/` を開いた直後にURL直接取り込みと候補検索が見える。
- 空の候補一覧だけが大きく表示されない。

### UX-B03: loading、empty、error表示を統一する

依存: UX-B01

目的: 処理中、0件、失敗を見分けられるようにする。

実装内容:

- 共通classとして `ui-state-loading`、`ui-state-empty`、`ui-state-error` を追加する。
- エラーには再試行操作か、次に確認すべき設定を表示する。
- 0件をエラー色にしない。
- API接続状態とデータ0件を別表示にする。

受け入れ条件:

- `/leads-view` の0件が、読み込み中のままに見えない。
- API失敗時に成功表示を残さない。

---

## Phase C: 1件のメール作業に集中できるようにする

### UX-C01: 状態ごとの主ボタンを1つだけ強調する

依存: UX-B03

変更場所:

- `renderMailStageCards()`
- 既存ボタンのdisabled状態を更新する処理
- `reviewButton`、`reReviewButton`、`approveButton`、`queueButton`

実装内容:

- 現在実行可能な「次操作」だけに `primary` classを付ける。
- 既存disabled条件は変えない。
- 危険・補助操作は通常ボタンにする。

受け入れ条件:

- 状態表どおりの主操作になる。
- checklist未完了時の承認・queueは無効のまま。
- 有効な主操作が同時に2つ表示されない。

### UX-C02: 選択案件と次操作の固定バーを作る

依存: UX-C01

実装内容:

- 会社名、メール状態、チェック完了数、次操作を1行へまとめる。
- desktopでは上部headerの下にsticky表示する。
- 980px以下ではstickyを解除する。
- 既存の詳細情報は削除しない。

受け入れ条件:

- 本文編集位置でも選択会社と次操作が見える。
- 上部headerと重ならない。
- 長い会社名でボタンが画面外へ出ない。

### UX-C03: メール画面を2ペイン化する

依存: UX-C02

実装内容:

- 981px以上で左320〜380pxを対象キュー、右側を作業領域にする。
- 対象キューは内部スクロールにする。
- 選択後もキューのスクロール位置を保つ。
- 980px以下では1カラムに戻す。
- このタスクではタブ化しない。

受け入れ条件:

- 56件をページ全体の縦方向へ展開しない。
- 本文編集領域が実用的な幅を保つ。
- 対象選択、メール選択、保存、チェック、状態遷移が従来どおり動く。

### UX-C04: 作業領域を4タブに分ける

依存: UX-C03

タブ:

1. 概要
2. 下書き
3. チェック・承認
4. 履歴

実装内容:

- 初期タブはmail状態から決める。
- メールなしは「概要」、`draft`/`rejected` は「下書き」、`in_review`/`approved` は「チェック・承認」、`sent` は「履歴」。
- タブ切り替えで入力値を消さない。
- URL変更や新しいrouterは追加しない。

受け入れ条件:

- 現在必要な作業が初期表示される。
- タブ切り替え後も本文の未保存入力が保持される。

### UX-C05: 「次の案件へ」を追加する

依存: UX-C03

実装内容:

- 現在の絞り込み・並び順における次のLeadを選択する。
- 次がない場合は「対象一覧の最後です」と表示する。
- 未保存の本文がある場合は移動前に警告する。
- API更新や自動保存は行わない。

受け入れ条件:

- 一覧先頭へ戻らず次の案件へ進める。
- 未保存本文を黙って破棄しない。

### UX-C06: 未保存変更を検知する

依存: UX-C04またはUX-C05

実装内容:

- 選択メール読み込み時の件名・本文を基準値として保持する。
- 入力変更後は「未保存」を表示する。
- 保存成功後だけ基準値を更新する。
- Lead変更、Mail変更、次案件移動時に未保存なら確認する。
- ブラウザ標準の離脱警告は、未保存時だけ有効にする。

受け入れ条件:

- 保存失敗時に「保存済み」と表示しない。
- 未保存内容を黙って破棄しない。

---

## Phase D: AI下書きの誤りを発見しやすくする

### UX-D01: 本文横に案件情報を表示する

依存: UX-C03

目的: 本文と元情報を同時に見比べる。

表示内容:

- 会社名
- 案件名
- 商品説明の短い抜粋
- 取得元
- URL
- 支援額、支援者数、残り日数

実装内容:

- 見出しは「案件情報と見比べる」とする。
- 値がない場合は「未取得」とする。
- 外部取得値は `escapeHtml()` を通す。
- このタスクでは自動一致判定をしない。

受け入れ条件:

- 本文を編集しながら案件情報を見られる。
- 狭い画面では案件情報を本文の上へ移動する。

### UX-D02: AIの根拠・仮定・リスクを表示する

依存: UX-D01

表示内容:

- `factsUsed`
- `assumptions`
- `riskFlags`
- 使用モデルと生成日時

実装内容:

- 根拠、仮定、リスクを別の見出しで表示する。
- `riskFlags` は警告色にする。
- 空配列と未取得を区別する。
- 履歴から別の生成結果を選んだ場合も表示を更新する。

受け入れ条件:

- AIが事実として使った情報と仮定を混同しない。
- リスクがないことを、検証済みと誤認させる表現にしない。

### UX-D03: 決定的な本文整合性チェックをdomainへ追加する

依存: UX-D01、UX-D02

このタスクから `ai` moduleを変更する。dashboardだけで業務判断を実装しない。

変更してよいファイル:

- `apps/api/src/ai/domain/draft-consistency.ts` 新規
- `apps/api/src/ai/domain/draft-consistency.spec.ts` 新規
- 必要なAI response DTO
- `apps/api/src/dashboard/dashboard.controller.ts`
- 関連docs

最初に実装する決定的ルール:

- 宛名の会社名が選択会社と異なる。
- 選択会社以外の既知会社名が本文に残る。
- 案件名から抽出した重要語が本文に1つも出ない。
- 本文が空、極端に短い、またはテンプレート変数が残る。
- `factsUsed` に存在しない数値実績が本文に含まれる可能性を警告する。

注意:

- 意味の類似を決定的ルールだけで断定しない。
- 「スモークサーモン」と「お米」のような意味不一致は、まず警告候補として表示する。
- 自動で安全と判定しない。
- この段階ではレビュー依頼をブロックしない。

受け入れ条件:

- 純粋関数としてDBやOpenAIなしでテストできる。
- 日本語、英数字、全角半角の正規化テストがある。
- 警告理由をUIへ表示できる構造化結果を返す。

### UX-D04: 整合性警告をレビュー前に再表示する

依存: UX-D03

実装内容:

- 本文横とレビュー操作直前に同じ警告を表示する。
- 警告があっても、現行ルールではレビュー依頼を自動ブロックしない。
- checklistの「別会社名や別商品名が残っていない」と関連付ける。
- 警告を確認せずチェックを自動完了しない。

受け入れ条件:

- 警告を見落としにくい。
- 人間が確認したという事実と、AIが安全判定したという表示を混同しない。

### UX-D05: AIによる意味整合性確認を追加する

依存: UX-D03、UX-D04

このタスクは任意。コスト、遅延、失敗時の扱いを先に決める。

設計条件:

- 既存メール生成とは別usecaseにする。
- JSON Schemaで結果を検証する。
- `matchesProject`、`suspectedForeignFacts`、`reason`、`confidence` を返す。
- API失敗時はメールやleadを更新しない。
- AIが安全と判定しても人間チェックを自動完了しない。
- 結果は助言であり、承認ルールの代わりにしない。

停止条件:

- 検証済みJSONを作れない場合はUIへ接続しない。

---

## Phase E: 営業案件一覧を判断画面にする

### UX-E00: 一覧判断に使える既存dataを監査する

このタスクは読み取りと設計だけ。コードを変更しない。

確認対象:

- Lead response
- project metrics
- mail status
- nextActionAt
- contact fields
- reply existence
- material engagement

成果物:

- 現在のAPIだけで表示できる「今対応する理由」
- API追加が必要な項目
- 値が未取得の場合の表示
- UX-E01、UX-E03、UX-F01が再利用するdata mapping

受け入れ条件:

- UI内へ新しいスコア計算を作らない方針が明記される。
- API追加が必要な場合は別タスク候補として分離される。

### UX-E01: 状態サマリーを絞り込み操作にする

依存: UX-B01、UX-B02、UX-B03、UX-E00

実装内容:

- サマリーの件数をクリックすると対応する状態で一覧を絞る。
- 選択中の条件を表示する。
- 解除操作を用意する。

受け入れ条件:

- 件数と一覧結果が一致する。
- 0件の状態をクリックしてもエラーにならない。

### UX-E02: CSV/TSV出力を補助メニューへ移す

依存: UX-E01

目的: 日常的な案件選択より出力操作を強く見せない。

実装内容:

- 出力領域を「その他」または折りたたみへ移す。
- 出力条件、形式、一覧用/詳細用の機能は残す。

受け入れ条件:

- CSV/TSVの内容とAPI呼び出しが変わらない。
- 初期画面で営業案件一覧が先に見える。

### UX-E03: 行に「今対応する理由」を表示する

依存: UX-E00

最初は既存dataだけを使う。

表示候補:

- 終了までN日
- 連絡先未確認
- 下書き確認待ち
- 承認待ち
- 返信あり
- 次対応期限超過
- 資料閲覧あり

禁止:

- UI内に新しいスコア計算を作らない。
- 新しい判断が必要なら `leads/domain` の別タスクにする。

受け入れ条件:

- Priorityが同じでも、次に行う仕事が分かる。

### UX-E04: 案件詳細を右パネル化する

依存: UX-E01

実装内容:

- desktopでは一覧の右側に選択案件詳細を表示する。
- mobileでは一覧の下へ表示する。
- 詳細上部に次操作を置く。
- 行選択とURLを開く操作を分ける。

受け入れ条件:

- 一覧位置を保ったまま複数案件を比較できる。
- 外部URLを誤って開きにくい。

---

## Phase F: 今日の営業を開始画面にする

### UX-F01: 「今日の営業」の表示仕様をdomain dataから定義する

依存: UX-E00

このタスクでは画面を作らない。純粋な分類ルールとテストを先に作る。

分類:

- 期限超過
- 今日が期限
- 下書き確認
- 承認待ち
- 送信待ち
- 返信あり
- 送信失敗

変更場所:

- `leads/domain` または専用のdashboard view model純粋関数
- 同じ場所のspec

禁止:

- controller内へ日時判断を直書きしない。
- timezoneを暗黙に扱わない。Asia/Tokyoの日付境界をテストする。

### UX-F02: `/today` 画面を追加する

依存: UX-F01、UX-A04

表示内容:

- 今日対応する総数
- 期限超過
- 下書き確認
- 承認待ち
- 返信あり
- 送信失敗
- 集中して処理する上位案件

実装条件:

- 最初は既存APIのdataから表示する。
- 新APIが必要ならUIタスクを止め、API仕様とOpenAPIを別タスクで更新する。
- カードをクリックすると既存画面の対応フィルターへ移動する。

受け入れ条件:

- 画面を開いて30秒以内に最初の案件を選べる。
- 0件の場合は「今日の対応はありません」と次の候補探索導線を表示する。

### UX-F03: 上部ナビゲーションに件数バッジを追加する

依存: UX-F02

表示:

- 今日の営業: 今日以前の未完了件数
- レビュー・送信: `in_review`、`approved`、`failed` の件数

受け入れ条件:

- バッジ取得失敗でナビゲーション全体が使えなくならない。
- 99件を超える場合の表示を定義する。

### UX-F04: `/today` を初期導線にする

依存: UX-F02、UX-F03

注意:

- `/` の既存URL検索を削除しない。
- 最初はナビゲーション先として `/today` を追加する。
- 利用確認後にのみ、ルート `/` の役割変更を別タスクで判断する。

---

## Phase G: 返信と次回対応を独立した仕事にする

### UX-G01: 返信一覧に必要なAPI差分を調査する

このタスクは読み取りと設計だけ。コードを変更しない。

確認対象:

- Reply model
- Mailとのrelation
- Lead status
- Gmail thread API
- 未返信、要対応、配信停止、苦情の取得可否

成果物:

- 必要なGET API
- response DTO
- filter
- pagination
- `docs/06_API.md` と `openapi/openapi.yaml` の更新案

### UX-G02: Reply Inboxの分類・表示用view modelを作る

依存: UX-G01

実装条件:

- DBやcontrollerを使わない純粋関数として、返信を表示カテゴリと優先度へ変換する。
- interested、need_info、meeting_request、not_interested、unsubscribe、complaint、auto_reply、unknownを扱う。
- unsubscribe/complaintをmanager確認対象として返す。
- domainまたはapplicationの同じ責務に単体テストを置く。

受け入れ条件:

- DBなしで分類と優先順位をテストできる。
- unsubscribe/complaintが通常返信より弱く表示されない。

### UX-G03: Reply Inbox repository queryを追加する

依存: UX-G01、UX-G02

実装条件:

- G01で決めたresponseに必要なReply、Mail、Lead、Company、Projectだけを取得する。
- filter、sort、paginationをrepositoryへ実装する。
- controllerやHTMLは変更しない。
- repositoryのquery条件をmockまたは実DB統合テストで固定する。

受け入れ条件:

- 1ページの上限がある。
- 同じreplyを重複して返さない。
- 会社NG、配信停止、苦情の識別に必要なdataを欠かさない。

### UX-G04: Reply Inbox API usecaseとcontrollerを追加する

依存: UX-G02、UX-G03

実装条件:

- application usecaseがrepositoryとview modelを組み合わせる。
- controllerはDTO検証とusecase呼び出しだけにする。
- pagination、filter、sortのDTOを追加する。
- `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- API単体テストを追加する。

受け入れ条件:

- API、DTO、application、repositoryの責務が混ざらない。
- 不正なfilterとpaginationを拒否する。
- unsubscribe/complaintのmanager確認情報を返す。

### UX-G05: `/replies` 画面を追加する

依存: UX-G04

表示:

- 会社、案件、返信分類、受信日時、担当、次操作
- interested、need_info、meeting_requestを優先表示
- unsubscribe、complaintを警告表示

禁止:

- unsubscribeやcomplaintへ通常フォローを提案しない。

### UX-G06: 次回対応のDB/API差分を調査する

依存: UX-G05

このタスクは読み取りと設計だけ。既存Lead updateで十分か、Task modelが必要かを判断する。

成果物:

- 必要なdata項目
- 状態遷移
- API案
- DB変更の有無
- timezoneと期限超過の扱い
- 既存Lead updateを再利用できる範囲

### UX-G07: 次回対応のbackendを追加する

依存: UX-G06

実装内容:

- 次回対応日時
- 対応内容
- 担当
- 完了状態

実装条件:

- G06でDB変更不要と判断した場合は、既存Lead usecaseを拡張する。
- Task modelが必要な場合は、schema/migration、domain、application、repository、API、docsをさらに別タスクへ分割し、このタスクでは一括実装しない。
- Asia/Tokyoの日付境界をテストする。

### UX-G08: 次回対応を記録するUIを追加する

依存: UX-G07

実装内容:

- 次回対応日時、対応内容、担当、完了状態を入力・表示する。
- 保存中、保存成功、保存失敗を区別する。
- 保存成功後に今日の営業の該当区分を更新する。

受け入れ条件:

- 保存失敗を完了扱いにしない。
- 期限超過と今日の期限が正しく表示される。

---

## Phase H: 見た目、アクセシビリティ、速度を仕上げる

### UX-H01: デザイントークンを整理する

実装内容:

- color、spacing、radius、font size、shadow、control heightをCSS custom propertyへ集約する。
- 状態色だけで意味を伝えず、文言またはiconを併用する。
- 既存accent色を維持し、全面的なブランド変更をしない。

### UX-H02: キーボード操作とfocusを修正する

確認項目:

- Tab順序
- focus-visible
- Enter/Spaceでのボタン・行選択
- details/summary
- dialogのfocus trapと復帰
- 外部URLと行選択の区別

### UX-H03: ラベルとアクセシブルネームを修正する

実装内容:

- placeholderだけに依存しないlabelを付ける。
- 同名の「選択」ボタンへ会社名を含むaccessible nameを付ける。
- 状態更新を必要に応じてaria-liveで通知する。
- table headerとinputの関連を確認する。

### UX-H04: responsiveを3幅で確認する

確認幅:

- 1440px desktop
- 1024px small desktop/tablet landscape
- 390px mobile

受け入れ条件:

- 横スクロールが必要なtableは、対象領域内だけでスクロールする。
- sticky領域が本文を隠さない。
- 主操作が画面外へ出ない。

### UX-H05: 描画量を抑える

依存: UX-C03、UX-E04

実装内容:

- 営業対象一覧をページングまたは段階表示する。
- 初期表示を10〜20件に限定する。
- 全56件分のボタンを同時に描画しない。
- filter、sort、selected leadを維持する。

禁止:

- パフォーマンス改善とAPI pagination追加を同じタスクにしない。

---

## Phase I: 巨大controllerを安全に分割する

UI/UXの主要動作が安定した後に行う。見た目変更とファイル分割を同じタスクで行わない。

目標構造:

```text
apps/api/src/dashboard/
  dashboard.controller.ts
  dashboard.controller.spec.ts
  README.md
  ui/
    dashboard-page-mode.ts
    shared-shell.ts
    shared-styles.ts
    url-search-page.ts
    leads-page.ts
    mail-workspace-page.ts
    client/
      api-client.ts
      state.ts
      render-leads.ts
      render-mail.ts
      render-projects.ts
```

これは最終目標であり、一括作成しない。

### UX-I01: page mode型と共通shellを分離する

依存: UX-A04

- body class、title、h1、active navだけを分離する。
- HTML出力を変えない。

### UX-I02: 共通CSS文字列を分離する

依存: UX-I01、UX-H01

- CSSだけを `shared-styles.ts` へ移す。
- selectorと出力順を変えない。
- visual regression確認を行う。

### UX-I03: URL検索ページの静的HTMLを分離する

依存: UX-I02

- 候補検索と候補一覧の静的HTMLだけを移す。
- client関数はまだ移さない。

### UX-I04: Lead一覧ページの静的HTMLを分離する

依存: UX-I02

- `leadsView()` の静的HTMLを移す。
- DOM idとAPI呼び出しを変えない。

### UX-I05: Mail workspaceの静的HTMLを分離する

依存: UX-I02

- 対象キュー、作業領域、タブの静的HTMLを移す。
- 状態判断は移さない。

### UX-I06: 純粋な表示判定だけをclient moduleへ分離する

依存: UX-I03〜I05

最初の候補:

- status label
- priority label
- next action label
- sort comparison
- filter predicate
- text truncation

禁止:

- fetch、DOM更新、状態遷移を最初の分割で混ぜない。

### UX-I07: API clientを分離する

依存: UX-I06

- fetch wrapperとerror normalizationだけを分離する。
- endpoint、method、payloadを変えない。
- API失敗テストを追加する。

### UX-I08: render領域を1つずつ分離する

依存: UX-I06、UX-I07

順序:

1. projects
2. leads
3. mail

1回の依頼で1領域だけ行う。

## 8. 最終受け入れシナリオ

全Phase完了時に、次を人間または高性能モデルが確認する。

### Scenario 1: 候補を追加する

1. 候補を探す画面を開く。
2. URL直接取り込みまたは条件検索を行う。
3. 検索中、成功、0件、失敗を区別できる。
4. 候補を営業案件へ追加できる。
5. 追加済み候補を重複追加しない。

### Scenario 2: 1件の下書きを作る

1. 今日の営業または営業案件からLeadを選ぶ。
2. 案件情報を確認する。
3. AI下書きを生成する。
4. 生成結果が `draft` で保存される。
5. 自動送信されない。

### Scenario 3: 誤生成を発見する

1. 選択案件と異なる会社名または商品情報を含むテスト下書きを表示する。
2. 案件情報と本文を同時に見比べられる。
3. 決定的チェックの警告理由を確認できる。
4. checklistをAIが自動完了しない。

### Scenario 4: レビューからqueueまで進める

1. 本文を編集・保存する。
2. レビュー依頼する。
3. checklist未完了では承認できない。
4. checklist完了後に承認できる。
5. `approved` 以外はqueueできない。
6. queue後も自動送信しない。

### Scenario 5: 棄却と再レビュー

1. `in_review` または許可された状態から棄却する。
2. 棄却理由が表示される。
3. 本文修正・保存後に再レビュー依頼できる。
4. 棄却理由を無視して承認へ進めない。

### Scenario 6: 未保存保護

1. 本文を変更する。
2. 別Lead、別Mail、次案件へ移動する。
3. 警告が表示される。
4. 保存成功後は警告が消える。
5. 保存失敗時は未保存状態を維持する。

### Scenario 7: 返信と次回対応

1. 返信あり案件を開く。
2. 返信分類と本文を確認する。
3. unsubscribe/complaintは警告される。
4. 次回対応を記録できる。
5. 今日の営業へ反映される。

### Scenario 8: responsiveとkeyboard

1. 1440px、1024px、390pxで主要操作が見える。
2. Tabキーで主操作へ到達できる。
3. focus位置が見える。
4. 2ペインが狭い画面で1カラムになる。

## 9. 最終Definition of Done

次をすべて満たして初めてUI/UX改善を完了とする。

- 今日やる案件を画面開始後30秒以内に選べる。
- 1件処理中、選択会社、メール状態、次操作を見失わない。
- 対象一覧へ戻らず次案件へ進める。
- 本文と案件情報、AIの仮定・リスクを同時に見られる。
- 別会社名、別商品情報の警告を表示できる。
- 未保存本文を黙って破棄しない。
- 状態ごとの主操作が1つに見える。
- checklist未完了の承認・queueを許さない。
- AI生成メールを自動送信しない。
- loading、empty、errorを区別できる。
- desktop、small desktop、mobileで主要操作を完了できる。
- keyboard操作とfocus表示が機能する。
- build、全単体テスト、重要な統合テストが通る。
- `docs/05_UI.md`、API docs、OpenAPI、DB docsが実装と矛盾しない。
- `dashboard.controller.ts` の責務が最終的に分割され、1変更の対象を小さく特定できる。

## 10. 高性能モデルが行う節目監査

低いモデルだけで連続実装しない。次の節目で高性能モデルが読み取り監査を行う。

- Phase A完了後: HTML契約と既存挙動が保持されているか。
- Phase C完了後: 状態遷移とdisabled条件が弱くなっていないか。
- Phase D完了後: AI警告を安全判定として誤表示していないか。
- Phase F完了後: 今日の営業の日時・timezone・件数が正しいか。
- Phase G完了後: unsubscribe/complaintの安全導線が守られているか。
- Phase I完了後: 分割による循環依存、重複helper、DOM契約破壊がないか。

監査では実装を同時に直さず、問題をタスクID付きで報告する。修正は新しい1タスクとして低いモデルへ渡す。

## 11. AIへ渡す依頼テンプレート

```text
営業AIシステムのUI/UX改善を行います。

最初に次を全文読んでください。
- AGENTS.md
- docs/19_LOW_MODEL_HANDOFF.md
- docs/21_UIUX_IMPLEMENTATION_STATUS.md
- docs/23_UIUX_MODEL_ROUTING_POLICY.md
- docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md のSection 0〜6
- docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md の指定タスク節
- docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md のSection 12
- 変更対象moduleのREADME
- 変更対象の既存テスト

今回は「UX-XXX」だけを実装してください。

ユーザーは必要に応じたモデル変更を許可しています。モデルrouting policyに従い、必要tierを満たす最小モデルを自分で選んでください。

必須条件:
- 指定タスク以外を実装しない
- 許可されたファイル以外を変更しない
- 既存API、payload、enum、DOM idを変えない
- メールの承認、checklist、queue、自動送信禁止ルールを弱めない
- ユーザーの既存変更を削除・巻き戻ししない
- 関連テストを更新する
- npm run build を実行する
- npm test -- --runInBand を実行する
- UI変更時は3画面をブラウザ確認する
- 全確認成功後だけ進捗表をcompleteにする
- 選択モデル、tier、reasoning、理由をExecution logへ記録する

完了報告には、変更ファイル、受け入れ条件の確認結果、build/test結果、
変えなかった安全ルール、残課題を含めてください。
```

## 12. AIが止まるべき条件

次の場合は推測で進めず、作業を止めて報告する。

- 許可ファイル外のAPI、DB、domain変更が必要になった。
- 既存の未コミット変更と同じ箇所を大きく書き換える必要がある。
- mail状態遷移またはchecklist条件が仕様と実装で矛盾している。
- 実メール送信を有効にしないと確認できない。
- 外部取得値を安全にescapeできない。
- OpenAI出力の検証方法が不明確。
- タスクの受け入れ条件を満たすために別タスクも同時実装する必要がある。
- buildまたは既存テスト失敗が今回の変更起因か判断できない。

止まる時は、判明した事実、必要な追加タスク、変更していないファイルを報告する。
