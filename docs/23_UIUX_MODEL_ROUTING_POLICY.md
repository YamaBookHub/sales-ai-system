# 23_UIUX_MODEL_ROUTING_POLICY

## 0. 目的

UI/UX改善を実行するAIが、タスクの難易度と危険度に応じて使用モデルとreasoning effortを自分で選び、必要なら強いモデルへ切り替えるための指示書。

全体のモデル選択は `docs/22_AI_MODEL_ROUTING.md` に従う。UI/UXタスクについて両文書の指定が異なる場合は、タスクIDごとの最低tierを定めるこの文書を優先する。

ユーザーは、このプロジェクトの `docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md` に従う作業について、AIがモデルを選択・変更することを許可している。許可範囲内のモデル変更について、AIは毎回ユーザーへ再確認しなくてよい。

ただし、利用中のCodex surfaceにモデル変更機能がない場合、AIは変更したふりをしてはならない。必要モデル、理由、引き継ぐタスクIDを明記して停止または対応可能なsurfaceへhandoffする。

## 1. 基本方針

1. 安さではなく、タスクを1回で安全に完了できる最小モデルを選ぶ。
2. 指定タスクの最低model tierより弱いモデルを使わない。
3. 同じタスク中に危険度が上がったら、作業を広げず強いモデルへ切り替える。
4. 強いモデルが不要になったら、次の独立タスクから小さいモデルへ戻してよい。
5. モデル変更はタスク境界で行うことを基本とする。
6. 途中変更する場合は、未完了の編集、テスト結果、判断事項を進捗表へ残す。
7. モデル名ではなく能力tierを正とする。モデルの廃止・追加時は同等以上の現行モデルへ置き換える。

## 2. Model tier

モデル名は2026-07-12時点の例。利用できない場合は、同等以上の能力を持つ現行モデルを選ぶ。

| Tier | 用途 | 現行モデルの例 | Reasoning |
|---|---|---|---|
| T0 | 文書、進捗表、単純な文字列修正 | GPT-5.4 nano相当 | low〜medium |
| T1 | 変更位置と期待結果が完全に固定された小規模実装 | GPT-5 mini、GPT-5.4 mini相当 | medium |
| T2 | 複数状態を扱うUI実装、既存コード内の限定的リファクタリング | GPT-5.4 mini相当 | high〜xhigh |
| T3 | domain、API、DB、日時、安全判定、複数module、巨大ファイル分割 | 利用可能な強いCodex向けモデルまたはfrontier coding model | high〜xhigh |
| T4 | Phase監査、設計矛盾、原因不明の失敗、安全性判断 | 利用可能な最上位のCodex向けモデルまたはfrontier model | xhigh以上 |

T0はコード実装へ使わない。T1は明確な小タスクだけに使う。営業メールの安全ルール、API、DB、AI出力検証をT0/T1へ任せない。

## 3. タスク別の最低tier

### T0でよい作業

- `docs/21_UIUX_IMPLEMENTATION_STATUS.md` の更新
- 調査結果の整形
- 誤字修正
- 既に承認された文言の機械的置換

T0だけでタスク完了判定をしない。コード変更を含む場合はT1以上が確認する。

### T1以上

- UX-A01、UX-A02、UX-A03
- UX-B01、UX-B02、UX-B03
- UX-E00、UX-E01、UX-E02
- UX-H01、UX-H03

条件:

- 変更対象が原則3ファイル以内。
- API、DB、domain ruleを変更しない。
- 受け入れ条件を自動テストまたは明確なDOM確認で判定できる。

### T2以上

- UX-A04
- UX-C01〜UX-C06
- UX-D01、UX-D02、UX-D04
- UX-E03、UX-E04
- UX-F03、UX-F04
- UX-G05、UX-G08
- UX-H02、UX-H04、UX-H05

理由:

- 複数のUI状態、未保存data、sticky、responsive、既存DOM契約を同時に扱う。
- 小さいモデルでも可能だが、reasoningはhigh以上を使う。

### T3以上

- UX-D03、UX-D05
- UX-F01、UX-F02
- UX-G01〜UX-G04、UX-G06、UX-G07
- UX-I01〜UX-I08

理由:

- AI出力検証、意味整合性、timezone、repository、API、DB判断、複数module、巨大controller分割を含む。
- 誤りがメール安全性または将来の保守性へ直接影響する。

### T4を使う作業

- 各Phase完了後の監査
- `mail` の状態遷移とUI表示が矛盾した場合
- checklist、承認、queue条件を変更する必要が生じた場合
- 既存テストが複数moduleで原因不明に失敗した場合
- domain、API、DB、UIのどこへ責務を置くか判断できない場合
- 2回連続で同じタスクが失敗した場合
- ユーザーの既存変更と大きく競合した場合

## 4. 自動選択手順

タスク開始時に次の順序で判定する。

1. `docs/21_UIUX_IMPLEMENTATION_STATUS.md` から次のタスクIDを1つ選ぶ。
2. `docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md` の対象タスク節を読む。
3. この文書の最低tier表を確認する。
4. 次の危険度加点を確認する。
5. 最低tierと危険度を満たす最小モデルを選ぶ。
6. 使用モデル、reasoning、選択理由を進捗表のExecution logへ記録する。
7. その後に編集を始める。

危険度加点:

| 条件 | 対応 |
|---|---|
| 4ファイル以上を変更 | 1 tier上げる |
| 2module以上を変更 | T3以上 |
| APIまたはOpenAPIを変更 | T3以上 |
| Prisma/schema/migrationを変更 | T3以上。DBとUIは別タスクにする |
| mail状態遷移、checklist、queueに接触 | T4で事前監査 |
| OpenAI出力検証に接触 | T3以上、Phase完了時T4監査 |
| timezone、期限超過、今日判定 | T3以上 |
| 4,000行級controllerの構造変更 | T3以上 |
| 既存テスト失敗の原因が不明 | T4へ切り替える |
| 既存未コミット変更と同じ箇所を編集 | 1 tier上げる。競合が大きければ停止 |

## 5. 小さいモデルへ下げてよい条件

次をすべて満たす場合だけ、次タスクからtierを下げてよい。

- 次タスクが独立している。
- 変更場所が検索語または `data-ui` で一意に特定できる。
- 許可ファイルが3つ以内。
- API、DB、domain、安全ルールを変更しない。
- 期待結果が文字列、DOM、CSS、純粋関数テストで確認できる。
- 直前タスクのbuildとtestが成功している。
- 進捗表に未解決の警告がない。

モデルを下げる目的でタスク範囲を曖昧にしてはならない。必要なら先にT3/T4でタスクを小さく再分割し、その後T1/T2へ渡す。

## 6. 強いモデルへ切り替える条件

次のどれかが発生した時点で、現在のモデルは編集を止める。

- 指定タスク外のファイル変更が必要になった。
- 受け入れ条件が2通り以上に解釈できる。
- 実装とdocsが矛盾している。
- buildまたはtest失敗を2回の調査で特定できない。
- mail状態遷移、承認、queueの条件へ影響する。
- AI生成メールを誤って安全と判定する可能性がある。
- DB migrationまたは破壊的data変更が必要になった。
- 同じタスクで2回修正しても受け入れ条件を満たさない。
- 大きな既存未コミット変更と競合する。

切り替え前に次を記録する。

```text
Task ID:
Current model/tier:
Required tier:
Completed work:
Uncommitted files:
Build/test results:
Blocking fact:
Recommended next action:
```

## 7. モデル変更ができる環境での動作

モデル選択機能、agent routing、handoffなどが利用できる場合:

1. ユーザーへの再確認なしで、必要tier以上のモデルを選ぶ。
2. 同じタスクのcontext、変更差分、テスト結果を引き継ぐ。
3. 強いモデルは最初に差分と進捗表を読み、最初から作り直さない。
4. 切り替え後のモデル名と理由をExecution logへ追記する。
5. タスク完了後、次タスクが条件を満たせば小さいモデルへ戻してよい。

モデル変更そのものが外部副作用や追加課金確認を必要とするsurfaceでは、そのsurfaceの確認ルールを優先する。

## 8. モデル変更ができない環境での動作

現在のsurfaceにモデル変更機能がない場合:

1. モデルを変更したと主張しない。
2. 現在のモデルが最低tierを満たすなら、そのまま1タスクだけ実装する。
3. 最低tierを満たさないなら編集しない。
4. Section 6の引き継ぎ情報を残す。
5. `docs/21_UIUX_IMPLEMENTATION_STATUS.md` を `blocked` にしない。モデル変更待ちは `in_progress` とし、Noteへ必要tierを書く。
6. 対応可能なモデルまたは別タスクへのhandoffを行う。

## 9. Phase監査

次の節目では、実装に使ったモデルに関係なくT4で監査する。

| 節目 | 監査内容 |
|---|---|
| Phase A | HTML契約、既存挙動、テスト保護 |
| Phase C | disabled条件、状態ごとの主操作、未保存保護 |
| Phase D | 誤生成警告、AI検証、人間確認の維持 |
| Phase F | 今日判定、Asia/Tokyo、件数、導線 |
| Phase G | unsubscribe、complaint、返信、次回対応 |
| Phase I | 循環依存、重複helper、DOM契約、build/test |

監査モデルはその場で大規模修正しない。問題を新しい修正タスクへ分解し、必要tierを指定する。

## 10. モデル選択の具体例

### 例1: UX-B01

- 内容: 表示文言の変更
- 最低tier: T1
- 選択: GPT-5.4 mini相当、medium
- 理由: Path、DOM id、APIを変えず、テストで確認できる

### 例2: UX-C03

- 内容: メール画面の2ペイン化
- 最低tier: T2
- 選択: GPT-5.4 mini相当、high
- 理由: responsiveと既存状態を同時に維持する必要がある

### 例3: UX-D03

- 内容: 本文整合性domain rule
- 最低tier: T3
- 選択: 強いCodex向けモデル、high以上
- 理由: 誤警告と見逃しの両方がメール品質へ影響する

### 例4: Phase D監査

- 内容: AI警告が人間承認を代替していないか確認
- 最低tier: T4
- 選択: 利用可能な最上位モデル、xhigh以上
- 理由: 複数moduleと安全原則の横断判断が必要

## 11. AIへ渡すモデル選択込みの依頼テンプレート

```text
営業AIシステムのUI/UX改善を続行してください。

最初に次を確認してください。
- AGENTS.md
- docs/19_LOW_MODEL_HANDOFF.md
- docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md の必要部分
- docs/21_UIUX_IMPLEMENTATION_STATUS.md
- docs/23_UIUX_MODEL_ROUTING_POLICY.md

ユーザーは、必要に応じてAIが使用モデルを変更することを許可しています。

手順:
1. 次の未完了タスクを1つだけ選ぶ
2. 最低model tierと危険度加点を確認する
3. 必要tierを満たす最小モデルとreasoningを選ぶ
4. モデル、tier、理由をExecution logへ記録する
5. 1タスクだけ実装する
6. build、test、必要なブラウザ確認を行う
7. 成功後だけタスクをcompleteにする
8. 強いモデルが必要になったら、再確認なしで切り替える

モデル変更機能がない場合は変更したふりをせず、引き継ぎ情報を残してください。
```
