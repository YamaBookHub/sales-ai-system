# 18_AI_MAINTAINABLE_ARCHITECTURE

## 目的

この文書は、営業AI支援システムをAIが安全に修正し続けるための設計方針をまとめる。

現在の基本方針は **Feature First Modular Monolith**。
ただし、業務ルールや外部連携が複雑な `mail` / `ai` / `leads` / `projects` は、必要な範囲だけ Clean Architecture 寄りに育てる。

## 全体方針

```text
apps/api/src/
  mail/
  ai/
  leads/
  projects/
  common/
```

機能単位でモジュールを分ける。
各モジュールの中で複雑になった責務だけ、次のように分ける。

```text
controller / dto
  API入力とレスポンス

application
  1つの操作、ユースケース、ジョブ進捗管理

domain
  業務ルール、判断、検証、スコア、ポリシー

infrastructure
  DB保存、外部サイト、外部API、Prisma repository

service
  既存APIの入口、全体の流れ、薄い委譲
```

重要なのは、最初から全ファイルを理想形に分けることではない。
壊れやすい判断や、AIが間違えやすい処理から順に分離する。

## AIが修正するときの原則

1. 業務ルールを変える場合は、まず `domain/` を見る。
2. DB保存や外部サービスの呼び方を変える場合は、`infrastructure/` を見る。
3. APIの入口やレスポンスを変える場合は、`controller` / `dto` を見る。
4. 1つの操作の流れを変える場合は、`application/` または service を見る。
5. 同じhelperを複数箇所に増やさず、`common/` または該当moduleの `domain/` に寄せる。
6. 重要ルールを変えたら、同じ階層の `*.spec.ts` を追加または更新する。

## mail module

役割は、営業メールの下書き、レビュー、承認、却下、送信待ち、送信済み、返信記録。

主な責務:

- `application/*.usecase.ts`: 承認、却下、レビュー依頼、送信待ちなどの操作
- `domain/mail-policy.ts`: 状態遷移、チェックリスト、禁止ルール
- `infrastructure/prisma-mail-workflow.repository.ts`: DB更新とイベント作成
- `mail.service.ts`: 既存API向けの薄い入口

変更時の目安:

- 「approved以外はqueue不可」などの条件変更は `domain/mail-policy.ts`
- DB更新やイベントの残し方は `infrastructure/prisma-mail-workflow.repository.ts`
- APIの追加は `mail.controller.ts` / `mail.dto.ts`

## ai module

役割は、リード分析、営業メール生成、OpenAI整形、返信分類。

主な責務:

- `openai-client.service.ts`: OpenAI API通信、応答読み取り、APIエラー処理
- `prompts/sales-mail-draft.prompt.ts`: OpenAIへ渡すプロンプト本文
- `domain/ai-output-validator.ts`: OpenAI JSON出力の検証
- `domain/openai-sales-mail-draft.ts`: OpenAI生成後の本文安定化
- `domain/local-lead-analysis.ts`: OpenAIを使わないリード分析
- `domain/local-mail-draft.ts`: OpenAIを使わないメール下書き生成
- `domain/reply-classifier.ts`: 返信分類
- `application/*.usecase.ts`: 分析、生成、整形、分類、履歴一覧

変更時の目安:

- モデルAPIやAPIエラーは `openai-client.service.ts`
- プロンプトは `prompts/`
- 生成メールの安全な形は `domain/openai-sales-mail-draft.ts`
- ローカル分析の判断は `domain/local-lead-analysis.ts`
- 返信分類の判定語句は `domain/reply-classifier.ts`

AI生成メールは下書き保存まで。自動送信しない。

## leads module

役割は、営業対象リードの状態、優先度、スコア、次アクションを管理すること。

主な責務:

- `domain/lead-policy.ts`: 状態、優先度、次アクション、フォロー日時
- `domain/lead-score.ts`: スコア計算
- `leads.service.ts`: DB取得、作成、更新、スコア保存

変更時の目安:

- 優先度や次アクションの判断は `domain/lead-policy.ts`
- スコア計算式は `domain/lead-score.ts`
- DTOや画面入力項目は `leads.dto.ts`

今後DB保存が太くなったら `infrastructure/` に repository を作る。

## projects module

役割は、CAMPFIRE、Makuakeなどの外部取得元から案件を検索・取り込み、会社・プロジェクト・営業リードを作ること。

主な責務:

- `domain/project-source-provider.ts`: 外部取得元providerの共通契約
- `domain/project-import-policy.ts`: 件数制限、URL重複、終了間近判定、一括取り込み集計
- `application/project-search-job.manager.ts`: 検索ジョブの開始、進捗、キャンセル、古いジョブ削除
- `infrastructure/*-project-source.provider.ts`: 外部サイト別の検索・取り込み実装
- `infrastructure/prisma-project-import.repository.ts`: 取り込み結果のDB保存、監査ログ
- `projects.service.ts`: provider選択、一括取り込みの流れ

変更時の目安:

- 新しい取得元を追加するなら `ProjectSourceProvider` に合わせて `infrastructure/` に追加
- 検索件数、URL重複、終了間近条件は `domain/project-import-policy.ts`
- 検索ジョブの進捗表示やキャンセルは `application/project-search-job.manager.ts`
- 会社、プロジェクト、リードの保存方法は `infrastructure/prisma-project-import.repository.ts`

## common

共通helperを置く。

現在の主な責務:

- `common/concurrency.ts`: 並列実行helper
- `common/api-response.ts`: APIレスポンス補助

複数moduleで使う処理だけを置く。
1つのmoduleに閉じる業務ルールは `common/` ではなく、そのmoduleの `domain/` に置く。

## テスト方針

優先してテストする対象:

- 状態遷移
- AI出力検証
- メール生成ルール
- リードスコア
- 取り込み重複判定
- 外部API失敗時の保護
- 自動送信しないこと

基本方針:

```text
domain の純粋関数
  低コストで壊れやすいので必ずテストする

application
  複数ルールを組み合わせる場合にテストする

infrastructure
  DBや外部APIの副作用が重要な場合にテストする
```

## 今後の優先順位

1. `PrismaProjectImportRepository` の実DB統合テスト基盤を整える
2. `leads` のDB保存が太くなったら repository 化する
3. `projects/application/*usecase.ts` を必要に応じて厚くする
4. 送信機能を追加する場合は `mail` に外部送信providerを作り、domainの承認ルールを先に固定する
5. 外部連携を増やす場合は、provider契約と失敗時の保護を先に決める

## 判断基準

このシステムは、完璧なClean Architectureを目指すより、AIが安全に直せることを優先する。

良い変更:

- 触る場所が明確になる
- 業務ルールが純粋関数になる
- 外部APIやDB保存が隔離される
- テスト対象が小さくなる
- 既存APIの挙動が変わらない

避ける変更:

- serviceに判断ルールを直書きする
- provider内に取得元と無関係な営業判断を入れる
- OpenAI出力を検証せずDB保存する
- AI生成メールを自動送信する
- 同じhelperを複数ファイルにコピーする
