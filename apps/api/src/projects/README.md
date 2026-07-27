# projects module

## 役割
CAMPFIRE、Makuake、GREEN FUNDINGなどの外部プロジェクト取得元から案件を検索・取り込み、会社・プロジェクト・営業リードを作る。

## 触ってよい場所
- API変更: `projects.controller.ts` / `projects.dto.ts`
- アプリケーション操作: `application/*usecase.ts`
- 検索ジョブ進捗管理: `application/project-search-job.manager.ts`
- 案件一覧・手動登録・取得元メタ情報: `projects.service.ts`
- 取得元共通インターフェース・正規化済み型: `domain/project-source-provider.ts`
- 検索・取り込み時の件数、重複URL、終了間近判定、一括取り込み集計: `domain/project-import-policy.ts`
- 外部サイト別実装: `infrastructure/*-project-source.provider.ts`
- 取り込み結果のDB保存: `infrastructure/prisma-project-import.repository.ts`
- 並列実行helper: `../common/concurrency.ts`

## レイヤー
- `projects.controller.ts`: HTTP入力を受け取り、usecase/serviceへ渡す。レスポンス形は変えない。
- `application/`: 検索・単体取り込み・一括取り込みなど、APIから呼ばれる操作名を置く。検索ジョブの進捗管理もここに置く。検索の主処理は `search-projects.usecase.ts`、単体取り込みの主処理は `import-project.usecase.ts`、一括取り込みの主処理は `bulk-import-projects.usecase.ts` に置く。
- `domain/`: provider契約、正規化済み取り込み型、操作主体など、外部サイトやDBに依存しない型を置く。
- `infrastructure/`: CAMPFIRE、Makuake、GREEN FUNDINGなど外部サイトに向き合う実装を置く。
- `infrastructure/prisma-project-import.repository.ts`: 正規化済み取り込み結果を会社・プロジェクト・リード・監査ログとして保存する。
- `projects.service.ts`: 案件一覧、手動登録、カテゴリ、登録済み取得元のメタ情報を扱う。検索・取り込みの流れは `application/search-projects.usecase.ts` / `application/import-project.usecase.ts` / `application/bulk-import-projects.usecase.ts` を見る。

## 重要ルール
- 新しい取得元は `ProjectSourceProvider` に合わせて追加する
- 取得元ごとの差分は provider 内に閉じ込める
- `ProjectsService` から見た入力は正規化済みの `NormalizedImportedProject` にする
- 重複URLは取り込み対象から外す
- 検索結果の重複判定や終了間近ソートは `domain/project-import-policy.ts` に集約する
- `project-source-provider.ts` とルート直下の provider ファイルは互換用の再export。新規コードは `domain/` と `infrastructure/` を直接参照する。

## 取得元を増やすための構造

CAMPFIRE / Makuake / GREEN FUNDINGで行っている処理を次の境界で揃え、新しい取得元も同じ流れへ追加できる構造を目標とする。

1. controllerは取得元と検索条件を受け取り、共通usecaseへ渡す。
2. applicationはproviderを選び、検索ジョブ、途中経過、停止、重複除外、単体・一括取り込みを共通処理として進める。
3. providerは取得元固有の検索、詳細取得、URL正規化、カテゴリ取得を行い、共通型へ変換する。
4. repositoryは正規化済み結果だけを受け取り、会社・プロジェクト・リードを保存する。

取得元固有のHTML構造、API仕様、表示文言、数値の読み取りは `infrastructure/` の各providerとparserに閉じ込める。application、domain、DB保存処理へサイト固有条件を持ち込まない。

### Provider registryとcapabilities

取得元ごとの直接分岐は `ProjectSourceRegistry` に集約する。各providerは、キーワード検索、カテゴリ、終了間近、金額、支援者数、過去プロジェクト数、途中経過通知、検索停止など、対応可能な検索機能をcapabilitiesとして宣言する。`GET /api/projects/sources` からこの情報を取得できるため、画面はサイト名で条件を決め打ちせず、未対応条件を送らない。

新しい取得元の追加単位は、provider、parser、fixture、provider固有テスト、registry登録とする。既存providerへの条件分岐追加や、共通usecaseへのサイト名判定追加では対応しない。

### 新しい取得元の追加手順

1. `infrastructure/` に `ProjectSourceProvider` を実装するproviderを追加する。
2. HTML解析は取得元専用parserへ置き、保存HTML fixtureで金額、支援者数、残日数、カテゴリ、実行者情報を固定する。
3. providerで `source`、`name`、`baseUrl`、`capabilities`、`categories`、`search`、`import`、`normalizeUrl` を実装する。
4. `projects.module.ts` の `PROJECT_SOURCE_PROVIDER_TYPES` にproviderクラスを1件登録する。
5. DBの `PlatformType`、API入力の `ProjectSource`、OpenAPIの列挙値へ取得元IDを追加する。
6. provider固有テストと、検索・単体取り込み・一括取り込みの回帰テストを実行する。

追加時にcontroller、検索usecase、単体取り込みusecase、一括取り込みusecaseへ取得元名の分岐を追加してはいけない。共通処理はregistryからproviderを受け取り、そのまま既存の検索ジョブ、停止、重複除外、保存、監査、AI分析へ流す。

### 検索プリセット

検索キーワード、除外キーワード、取得元、終了日条件、取得件数などの検索プリセットは、将来の組織別DB設定として扱う。初期値をファイルから読み込む場合も、実運用の正本はDBとし、検索ジョブには実行時点の条件をスナップショットとして残す。HTML selectorや抽出ルールは検索プリセットへ含めない。

### Parserとfixture

HTML selector、取得元固有のfallback、金額・支援者数・残日数などの抽出ルールはコード内のparserに保持する。設定ファイルだけで変更可能にせず、保存済みHTML fixtureを使ったテストで画面変更と誤抽出を検知する。fixtureには通常表示、文言違い、欠損値、終了済み・公開前など、実際に確認した主要パターンを含める。

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
