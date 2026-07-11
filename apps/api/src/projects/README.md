# projects module

## 役割
CAMPFIRE、Makuakeなどの外部プロジェクト取得元から案件を検索・取り込み、会社・プロジェクト・営業リードを作る。

## 触ってよい場所
- API変更: `projects.controller.ts` / `projects.dto.ts`
- アプリケーション操作: `application/*usecase.ts`
- 検索ジョブ進捗管理: `application/project-search-job.manager.ts`
- 互換用の業務入口: `projects.service.ts`
- 取得元共通インターフェース・正規化済み型: `domain/project-source-provider.ts`
- 検索・取り込み時の件数、重複URL、終了間近判定、一括取り込み集計: `domain/project-import-policy.ts`
- 外部サイト別実装: `infrastructure/*-project-source.provider.ts`
- 取り込み結果のDB保存: `infrastructure/prisma-project-import.repository.ts`
- 並列実行helper: `../common/concurrency.ts`

## レイヤー
- `projects.controller.ts`: HTTP入力を受け取り、usecase/serviceへ渡す。レスポンス形は変えない。
- `application/`: 検索・単体取り込み・一括取り込みなど、APIから呼ばれる操作名を置く。検索ジョブの進捗管理もここに置く。検索の主処理は `search-projects.usecase.ts`、単体取り込みの主処理は `import-project.usecase.ts`、一括取り込みの主処理は `bulk-import-projects.usecase.ts` に置く。
- `domain/`: provider契約、正規化済み取り込み型、操作主体など、外部サイトやDBに依存しない型を置く。
- `infrastructure/`: CAMPFIRE、Makuakeなど外部サイトに向き合う実装を置く。
- `infrastructure/prisma-project-import.repository.ts`: 正規化済み取り込み結果を会社・プロジェクト・リード・監査ログとして保存する。
- `projects.service.ts`: 既存API互換の入口。新しい検索・取り込みの流れは `application/search-projects.usecase.ts` / `application/import-project.usecase.ts` / `application/bulk-import-projects.usecase.ts` を先に見る。

## 重要ルール
- 新しい取得元は `ProjectSourceProvider` に合わせて追加する
- 取得元ごとの差分は provider 内に閉じ込める
- `ProjectsService` から見た入力は正規化済みの `NormalizedImportedProject` にする
- 重複URLは取り込み対象から外す
- 検索結果の重複判定や終了間近ソートは `domain/project-import-policy.ts` に集約する
- `project-source-provider.ts` とルート直下の provider ファイルは互換用の再export。新規コードは `domain/` と `infrastructure/` を直接参照する。

## AI向け注意
外部サイトを増やす場合は、既存providerを直接肥大化させず、`infrastructure/` に新しい provider ファイルを追加する。検索・取り込みのAPI経路を増やす場合は、まず `application/` にusecaseを置き、既存APIの挙動を変えない形から始める。検索件数、URL正規化後の重複、終了間近条件を変える場合は `domain/project-import-policy.ts` と `application/search-projects.usecase.ts` を先に見る。
検索ジョブの開始、進捗メッセージ、キャンセル、古いジョブ削除を変える場合は `application/project-search-job.manager.ts` を見る。
DB保存内容、会社の更新方針、リードupsert、取り込み単位または一括取り込み全体の監査ログを変える場合は `infrastructure/prisma-project-import.repository.ts` を見る。
並列実行の挙動を変える場合は `common/concurrency.ts` を見る。providerやservice内に同じhelperを増やさない。

## テスト
- 検索・取り込みルールは `domain/project-import-policy.spec.ts`
- 検索の流れは `application/search-projects.usecase.spec.ts`
- 単体取り込みの流れは `application/import-project.usecase.spec.ts`
- 一括取り込みの流れは `application/bulk-import-projects.usecase.spec.ts`
- DB保存境界は `infrastructure/prisma-project-import.repository.spec.ts`
