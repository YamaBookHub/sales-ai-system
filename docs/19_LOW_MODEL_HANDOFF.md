# 19_LOW_MODEL_HANDOFF

## この文書の目的

使用量の少ないモデルでも、現在の設計を壊さずに続きを実装できるよう、2026-07-11時点の現在地と残作業を固定する。

## 現在の結論

現在の設計思想は、このMVPに適している。

- 基本構造: Feature First Modular Monolith
- 複雑なmodule: 必要な範囲だけ Clean Architecture 寄り
- 業務ルール: domainの純粋関数へ分離
- 操作単位: applicationのusecaseへ分離
- DB・外部サイト・OpenAI: infrastructureまたは専用clientへ分離
- 既存service: API互換を保つ薄い入口として段階的に縮小

完全なClean Architectureではない。DTOをdomainが参照する箇所や、applicationが具象repositoryを参照する箇所は残っている。しかし、現段階で全面的に直す価値は低く、MVPの速度とAIの修正精度を優先してよい。

## 完了していること

### mail

- 状態遷移と禁止条件を `domain/mail-policy.ts` に分離
- レビュー、承認、却下、queue、送信済み、retryをusecase化
- Prismaによる状態更新とイベント作成をrepositoryへ分離
- 重要な状態遷移ルールの単体テストを追加
- 実送信の安全な入口、sender契約、未設定providerを追加
- `queued` から `sending` への条件付きclaimで二重送信を防止
- `MAIL_SEND_ENABLED` / `MAIL_SENDER_PROVIDER` によるsender設定入口を追加
- Gmail provider用の必須認証設定チェックを追加
- 会社資料リンクのクリック追跡を営業温度感へ反映
- メール/サイトDM/問い合わせフォーム用の定型文テンプレート管理を追加

### ai

- リード分析、下書き生成、OpenAI整形、返信分類、履歴一覧をusecase化
- OpenAI通信、プロンプト、JSON検証、生成後の補正を分離
- ローカル分析・ローカルメール生成をdomainへ分離
- 出力検証、件名、生成文面、返信分類の単体テストを追加
- AI下書き生成とOpenAI整形のusecaseテストを追加

### leads

- 状態、優先度、次アクションを `domain/lead-policy.ts` に集約
- スコア計算を `domain/lead-score.ts` に集約
- 両方の単体テストを追加
- スコア更新を `application/score-lead.usecase.ts` と `infrastructure/prisma-lead.repository.ts` に分離

### projects

- CAMPFIRE / Makuakeをproviderとして分離
- 外部取得結果を共通形式へ正規化
- 検索・取り込みルールをdomainへ分離
- 検索ジョブ管理をapplicationへ分離
- 検索の主処理を `application/search-projects.usecase.ts` へ移動
- 単体取り込みの主処理を `application/import-project.usecase.ts` へ移動
- 一括取り込みの主処理を `application/bulk-import-projects.usecase.ts` へ移動
- Prisma保存と監査ログをrepositoryへ分離
- 共通の並列実行helperとテストを追加
- 実DB統合テストの最小基盤を追加

## 現在の重要制約

1. AI生成メールは必ず `draft` のまま保存し、人間が確認する。
2. `approved` 以外はqueueできない。
3. checklist未完了なら承認・queueできない。
4. 同じleadにメールを重複作成しない。
5. OpenAI呼び出し失敗時はDB更新を開始しない。
6. 外部取得元のHTMLやAPI差分をserviceやdomainへ漏らさない。
7. 会社資料リンクのクリックは `company_material` として扱い、leadのアポ角度判断に使う。

## 残作業の優先順位

### P1: mail / ai のusecaseテスト 完了

次の事故を小さなテストで防ぐ。

- AI下書きが `draft` で保存されることを確認済み
- 既存メールがあるleadには重複生成しないことを確認済み
- OpenAI失敗時にtransactionを開始せず、既存メールを変更しないことを確認済み
- 承認前またはchecklist未完了ではqueueしないことを確認済み

追加済み:

- `apps/api/src/ai/application/generate-mail-draft.usecase.spec.ts`
- `apps/api/src/ai/application/polish-mail.usecase.spec.ts`
- `apps/api/src/mail/application/queue-mail.usecase.spec.ts`

### P2: 実DB統合テストの最小基盤 完了

`PrismaProjectImportRepository` を中心に、会社・案件・lead・監査ログが1transactionで正しく保存されることを実DBで確認する基盤を追加済み。

- 通常の `npm test` からは除外
- `TEST_DATABASE_URL` がない場合はskip
- 実行コマンド: `TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/sales_ai_system' npm run test:integration`
- 追加先: `apps/api/src/projects/infrastructure/prisma-project-import.repository.integration-spec.ts`

### P3: leadsのDB境界分離 一部完了

`leads.service.ts` のうち、壊すと影響が大きいスコア更新だけ先に分離済み。

- `application/score-lead.usecase.ts` 追加済み
- `infrastructure/prisma-lead.repository.ts` 追加済み
- `application/score-lead.usecase.spec.ts` 追加済み

`update` は会社・案件・leadを同時に更新するため、今すぐ全面分離しなくてよい。DTO変換や更新順序がさらに増えた時だけ `application/update-lead.usecase.ts` へ切り出す。

### P4: projectsのapplication層強化 完了

検索の流れは `application/search-projects.usecase.ts` へ移動済み。provider選択、終了間近ソート、検索ジョブ開始をusecase側で扱う。

単体取り込みの流れは `application/import-project.usecase.ts` へ移動済み。provider選択、URL正規化、公開中チェック、保存をusecase側で扱う。

一括取り込みの流れは `application/bulk-import-projects.usecase.ts` へ移動済み。重複URL除外、provider選択、取り込み、任意のAI分析、監査ログ記録をusecase側で扱う。

- `application/search-projects.usecase.ts` 強化済み
- `application/search-projects.usecase.spec.ts` 追加済み
- `application/import-project.usecase.ts` 強化済み
- `application/import-project.usecase.spec.ts` 追加済み
- `application/bulk-import-projects.usecase.ts` 強化済み
- `application/bulk-import-projects.usecase.spec.ts` 追加済み

projectsの主要操作はapplication層に移動済み。今後は見た目を整えるだけの移動はしない。

### P5: 実送信機能の設計 一部完了

実送信provider未接続の安全な土台まで追加済み。

追加済み:

- `domain/mail-sender.ts`: `MailSender` 契約と `MAIL_SENDER` token
- `domain/mail-policy.ts`: `assertCanSendQueued`
- `application/send-queued-mail.usecase.ts`: queued + checklist完了だけ実送信へ進める
- `infrastructure/disabled-mail.sender.ts`: provider未設定時は必ず失敗させる
- `infrastructure/mail-sender.config.ts`: `MAIL_SEND_ENABLED=true` で明示しない限りdisabledにする
- `infrastructure/gmail-mail-sender.config.ts`: `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_FROM_EMAIL` を検証
- `PrismaMailWorkflowRepository`: `queued` のみを `sending` にclaimし、`sent` / `failed` へ遷移
- `POST /mails/:id/send`: 実送信入口
- `application/send-queued-mail.usecase.spec.ts`: 送信条件、claim失敗時にproviderを呼ばないこと、失敗時failed、idempotency keyを固定
- `infrastructure/prisma-mail-workflow.repository.spec.ts`: queued以外をclaimしないことを固定
- `infrastructure/mail-sender.config.spec.ts`: provider指定だけでは実送信が有効にならないことを固定
- `infrastructure/gmail-mail-sender.config.spec.ts`: Gmail認証設定の不足検知を固定

まだ未実装:

- Gmail等の具象provider
- provider側の本当の冪等送信
- 外部API retry方針
- 送信監査ログの詳細化

### P6: 資料閲覧によるアポ角度判定 一部完了

会社資料リンクを追跡URL化し、クリックされた場合にleadの温度感へ反映する土台を追加済み。

追加済み:

- `POST /t/links`: `emailId` と資料URLから追跡リンクを作成
- `GET /t/click/:token`: クリックを記録して元URLへリダイレクト
- `GET /t/mails/:emailId/engagement`: メール単位の資料閲覧サマリーを返す
- `tracking/domain/material-engagement-policy.ts`: クリック回数から `interested` / `hot` を判定
- `tracking/tracking.service.ts`: `company_material` クリック時にleadの `score` / `priority` / `status` / `nextActionAt` を更新
- `tracking/tracking.service.spec.ts`: リンク作成、クリック記録、lead温度感更新を固定
- Mail workspaceの「会社資料の閲覧状況」: 閲覧有無、回数、最終閲覧、アポ角度を選択メールごとに表示

まだ未実装:

- メール本文内の資料URLを自動で追跡URLへ置換
- AI分析への資料閲覧履歴の入力

### P7: 定型文テンプレート管理 一部完了

営業メールだけでなく、CAMPFIRE / Makuake のプロフィール直メッセージや問い合わせフォーム文面を取り込んで修正保存できる土台を追加済み。

追加済み:

- `MailTemplate` model
- `POST /mails/templates`: `key` 単位で定型文を作成・上書き保存
- `POST /mails/templates/import`: 複数テンプレートを一括取り込み
- `GET /mails/templates`: activeなテンプレート一覧
- `GET /mails/templates/:key`: key指定で取得
- `mail-templates.service.spec.ts`: 上書き保存と一括取り込みを固定
- `20260712000000_mail_templates`: `MailTemplate` テーブルのDBマイグレーション
- Mail workspaceの「定型文管理」: 一覧、編集、保存、JSON一括取り込み
- `GenerateMailDraftUseCase`: 有効な `email` 定型文を `templateKey` から参照して本文・件名へ適用
- 定型文の差し込み変数: `{{companyName}}` / `{{projectTitle}}` / `{{platformName}}` / `{{projectUrl}}` / `{{category}}` / `{{appeal}}` / `{{targetUser}}` / `{{subjectType}}`
- 未登録キーは従来のローカル生成へフォールバックし、未置換変数は `riskFlags` に残す

まだ未実装:

- `sendMethod` に応じたテンプレート推奨
- 資料追跡リンクをテンプレートへ差し込む補助

## 追加してよい設計要素

今後追加価値が高いものは次の3点だけ。

- application/usecaseテスト: 複数のルールとDB更新の順番を守る
- 外部連携の境界テスト: OpenAI、取得元、将来のメール送信を隔離する
- 構造チェック: `apps/api/src/architecture/dependency-rules.spec.ts` でdomainからDB service、外部client、application/infrastructureをimportしていないことを守る

CQRS、イベントソーシング、マイクロサービス、汎用BaseRepository、全Entityのクラス化はMVPでは追加しない。

## 小さいモデルへの作業指示

- 1回の依頼で1module、1目的だけ変更する。
- 最初に変更対象moduleのREADMEを読ませる。
- 「既存APIの挙動を変えない」「関連テストを追加」「buildとtestを実行」を毎回含める。
- 抽象的に「設計を改善して」と依頼せず、対象usecaseと守る条件を指定する。
- 迷った場合は新しい層や共通化を作らず、既存パターンに合わせる。

次に着手する作業は、`sendMethod` に応じたテンプレート推奨か、資料閲覧状況を営業案件・メール画面へ表示すること。

## UI/UX改善の進め方

営業画面のUI/UX改善は `docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md` を正とする。

- 低いモデルは1回に1つのタスクIDだけ実装する。
- Phase Aから順に進める。
- 実装状況と次タスクは `docs/21_UIUX_IMPLEMENTATION_STATUS.md` で確認する。
- 使用モデルとreasoningは `docs/23_UIUX_MODEL_ROUTING_POLICY.md` に従い、AI自身が選択・変更する。
- UI変更とAPI、DB、domain、状態遷移の変更を同時に行わない。
- 各Phaseの節目で高性能モデルが安全性と整合性を監査する。
- 最終形には今日の営業、2ペインのメール作業、誤生成警告、返信対応、アクセシビリティ、巨大controllerの段階分割まで含む。

UI/UX改善の依頼では、まず同指示書から未完了の最小タスクを1つ選ぶ。
