# 35_OPPORTUNITY_PIPELINE_CONTRACT

## 目的

`SO-004` の正本として、営業対象の発見から受注・失注までを追跡する商談パイプライン、状態履歴、担当、金額、確度、予定日、失注理由を定義する。

この文書は後続の `SO-005` が実装する契約である。`SO-004` ではPrisma schemaやmigration、API、画面を変更しない。

## 設計判断

### Opportunityを導入する

`LeadStatus` は拡張せず、`SalesLead` と1対1の `Opportunity` を追加する。

理由:

1. 現行の `LeadStatus` は候補選定、メール下書き、レビュー、送信、返信を表し、商談段階とは責務が異なる。
2. メールの再作成や再レビューでLead状態が変わっても、提案中・受注済みなどの商談段階を巻き戻してはいけない。
3. 既存のLead API、メール状態連動、今日の営業、返信分類との互換性を保てる。
4. 商談段階、受注金額、失注理由を一つの集計単位へ固定できる。

### 正本の分担

| 情報 | 正本 |
|---|---|
| 候補発見、優先度、メール作業、返信対応 | `SalesLead` |
| メール下書き、レビュー、送信記録 | `OutreachEmail` / `EmailEvent` |
| 返信本文、返信分類 | `EmailReply` |
| 次回対応、期限、担当作業 | `Task` |
| 商談の現在段階、担当、金額、確度、予定日、受注・失注 | `Opportunity` |
| 商談段階を誰がいつ変えたか | `OpportunityStageHistory` |
| 商談項目の編集監査 | `AuditLog` |

`LeadStatus` は互換用の業務状態として残す。商談率、受注率、失注理由の集計には使用しない。

## 集計単位

- 1件の非削除 `SalesLead` に対して、`Opportunity` は最大1件とする。
- 同じ会社でもクラウドファンディング案件が異なれば別Lead、別Opportunityとして扱う。
- 現在のファネル件数は `Opportunity.stage` を数える。
- 期間内の段階到達数は `OpportunityStageHistory.toStage` と `createdAt` を数える。
- 受注金額は現在 `stage = won` の `wonAmount` を合計する。
- 失注理由は現在 `stage = lost` の `lossReason` を数える。
- `excluded` は営業対象外であり、失注率の分子・分母に含めない。
- 日付集計の業務timezoneは `Asia/Tokyo` とする。
- 取得元別集計は `SalesLead.project.platform.type` を使い、画面に表示中の件数を母数にしない。

## 状態

### OpportunityStage

| 値 | 表示 | 意味 |
|---|---|---|
| `uncontacted` | 未接触 | まだ相手へ連絡していない |
| `contacted` | 送信済み | メール、サイト内メッセージ、問い合わせフォームのいずれかで連絡済み |
| `replied` | 返信あり | 相手から返信があり、内容確認または次対応が必要 |
| `meeting` | 商談 | 面談・打ち合わせの日程調整中または実施中 |
| `proposal` | 提案 | 提案書・見積を提示済み、または提示準備中 |
| `won` | 受注 | 受注意思と金額を確認済み |
| `lost` | 失注 | 商談・提案後に受注へ至らなかった |
| `excluded` | 対象外 | 重複、送信禁止、連絡先不明などで営業対象にしない |

### OpportunityLossReason

| 値 | 表示 |
|---|---|
| `no_interest` | 関心なし |
| `no_budget` | 予算なし |
| `timing` | 時期が合わない |
| `no_response` | 返信途絶 |
| `competitor` | 他社採用 |
| `service_mismatch` | 支援内容が合わない |
| `contact_unavailable` | 有効な連絡先なし |
| `duplicate` | 重複案件・重複接触 |
| `other` | その他 |

`lost` へ進める場合は `lossReason` が必須である。`other` では `lossReasonDetail` も必須とする。`excluded` は失注理由を使わず、遷移履歴の `reason` に対象外理由を保存する。

## 状態遷移

### 通常遷移

| 現在 | 許可する次状態 |
|---|---|
| `uncontacted` | `contacted`, `excluded` |
| `contacted` | `replied`, `meeting`, `proposal`, `lost`, `excluded` |
| `replied` | `meeting`, `proposal`, `lost`, `excluded` |
| `meeting` | `proposal`, `won`, `lost` |
| `proposal` | `won`, `lost` |
| `won` | なし |
| `lost` | なし |
| `excluded` | なし |

同じ状態への遷移と後方遷移は409で拒否する。`lost` と `excluded` を混同せず、接触前の無効案件は `excluded` を使う。

### 再開

- `lost` / `excluded` からの再開は通常遷移と分け、managerまたはadminだけが実行できる。
- 再開先は `uncontacted`、`contacted`、`replied`、`meeting`、`proposal` のいずれかを明示する。
- 再開時は失注理由、失注日時、対象外理由を現在値から消し、履歴には残す。
- `won` は訂正専用操作以外で再開しない。訂正はadminのみとし、理由を必須にする。

### 外部業務イベントとの連動

| イベント | Opportunity更新 |
|---|---|
| メール・サイトDM・問い合わせフォームを送信済みに記録 | `uncontacted` の場合だけ `contacted` へ進める |
| 返信を記録 | `uncontacted` / `contacted` の場合だけ `replied` へ進める |
| `meeting_request` 返信を記録 | `uncontacted` / `contacted` / `replied` の場合だけ `meeting` へ進める |
| 会社blockまたは連絡先unsubscribe | `won` / `lost` 以外の案件を `excluded` にできる。自動遷移を行う場合も履歴を作る |

システム連動は前方にだけ進め、`proposal`、`won`、`lost` をメールや返信イベントで巻き戻さない。AI分類だけで `won` / `lost` にしない。

## 提案するDB差分

次の差分は `SO-005` でmigrationとして実装する。ここではschemaを変更しない。

### enum

```prisma
enum OpportunityStage {
  uncontacted
  contacted
  replied
  meeting
  proposal
  won
  lost
  excluded
}

enum OpportunityLossReason {
  no_interest
  no_budget
  timing
  no_response
  competitor
  service_mismatch
  contact_unavailable
  duplicate
  other
}

enum OpportunityChangeSource {
  manual
  system
  migration
}
```

### Opportunity

```prisma
model Opportunity {
  id                 String                 @id @default(uuid()) @db.Uuid
  leadId             String                 @unique @db.Uuid
  ownerId            String?                @db.Uuid
  stage              OpportunityStage       @default(uncontacted)
  probability        Int                    @default(0)
  expectedAmount     Int?
  wonAmount          Int?
  meetingScheduledAt DateTime?
  expectedCloseDate  DateTime?
  wonAt              DateTime?
  lostAt             DateTime?
  lossReason         OpportunityLossReason?
  lossReasonDetail   String?
  stageChangedAt     DateTime               @default(now())
  version            Int                    @default(1)
  createdAt          DateTime               @default(now())
  updatedAt          DateTime               @updatedAt

  lead    SalesLead                @relation(fields: [leadId], references: [id])
  owner   User?                    @relation("OpportunityOwner", fields: [ownerId], references: [id])
  history OpportunityStageHistory[]

  @@index([stage, updatedAt])
  @@index([ownerId, stage])
  @@index([expectedCloseDate])
}
```

金額は既存案件と同じく円単位の `Int` とし、0以上に制限する。`probability` は0から100の整数とする。DBのCHECK制約とdomain policyの両方で検証する。

### OpportunityStageHistory

```prisma
model OpportunityStageHistory {
  id            String                  @id @default(uuid()) @db.Uuid
  opportunityId String                  @db.Uuid
  fromStage     OpportunityStage?
  toStage       OpportunityStage
  changedById   String?                 @db.Uuid
  source        OpportunityChangeSource @default(manual)
  sourceId      String?
  reason        String?
  operationKey  String?                 @unique
  versionAfter  Int
  snapshot      Json?
  createdAt     DateTime                @default(now())

  opportunity Opportunity @relation(fields: [opportunityId], references: [id])
  changedBy   User?       @relation("OpportunityStageChanger", fields: [changedById], references: [id])

  @@index([opportunityId, createdAt])
  @@index([toStage, createdAt])
  @@index([changedById, createdAt])
}
```

履歴は追記専用とし、更新・削除APIを作らない。`sourceId` には自動連動元のmail IDやreply IDを保存する。`snapshot` には遷移時の担当、確度、金額、予定日、失注理由を保存し、後日の項目変更で当時の判断が変わらないようにする。

### 既存modelへのrelation

- `SalesLead.opportunity Opportunity?`
- `User.ownedOpportunities Opportunity[] @relation("OpportunityOwner")`
- `User.opportunityStageChanges OpportunityStageHistory[] @relation("OpportunityStageChanger")`

## 項目ルール

| 項目 | ルール |
|---|---|
| `ownerId` | nullは未担当。指定時は削除されていないactive Userだけを許可 |
| `probability` | 0から100。段階変更時の既定値は未接触0、送信済み10、返信25、商談50、提案75、受注100、失注・対象外0 |
| `expectedAmount` | 0以上。提案前でも入力可 |
| `wonAmount` | `won` へ進める場合は必須かつ0以上 |
| `meetingScheduledAt` | 商談予定日時。未確定ならnullを許可し、Taskで日程調整を管理 |
| `expectedCloseDate` | 提案・商談の受注見込日。任意 |
| `lossReason` | `lost` の場合だけ必須 |
| `lossReasonDetail` | `lossReason = other` の場合は必須 |
| `version` | 更新ごとに1増やし、同時更新の競合検知に使う |

段階変更時に確度が明示されていなければ表の既定値を設定する。人が明示した確度は0から100の範囲で保持する。

`won` / `lost` / `excluded` へ進めると `SalesLead.nextActionAt` と `nextFollowUpAt` を消す。既存の未完了Taskは勝手に削除せず、同じtransactionで `cancelled` にして履歴を残す。受注後Taskは別機能のため本契約には含めない。

## API契約

既存routeは変更せず、新しいrouteを追加する。response wrapperは `{ data, meta, error }` を維持する。

### 一覧

`GET /api/opportunities`

query:

- `page`, `limit`
- `stage`
- `ownerId`
- `source`
- `expectedCloseFrom`, `expectedCloseTo`
- `updatedFrom`, `updatedTo`

server paginationを必須とし、Lead、Company、Project、Platform、次の未完了Taskを必要な範囲だけ返す。

### Leadに紐づく商談取得

`GET /api/leads/{leadId}/opportunity`

- 商談現在値と直近の状態履歴を返す。
- 非削除Leadに商談が未作成の場合は、移行漏れとして404ではなく409を返す。

### 商談項目更新

`PATCH /api/leads/{leadId}/opportunity`

```json
{
  "expectedVersion": 3,
  "ownerId": "uuid-or-null",
  "probability": 60,
  "expectedAmount": 500000,
  "meetingScheduledAt": "2026-07-25T04:00:00.000Z",
  "expectedCloseDate": "2026-08-31T14:59:59.999Z"
}
```

状態はこのAPIで変更しない。更新前後を `AuditLog` に保存し、versionを1増やす。

### 状態遷移

`POST /api/leads/{leadId}/opportunity/transitions`

```json
{
  "expectedVersion": 3,
  "operationKey": "client-generated-uuid",
  "toStage": "proposal",
  "reason": "初回提案書を送付",
  "probability": 75,
  "expectedAmount": 500000,
  "expectedCloseDate": "2026-08-31T14:59:59.999Z"
}
```

`won` では `wonAmount`、`lost` では `lossReason` と必要に応じて `lossReasonDetail` を追加する。状態更新と履歴作成は同じtransactionで行う。

### 再開

`POST /api/leads/{leadId}/opportunity/reopen`

- `expectedVersion`、`operationKey`、`toStage`、`reason`を必須にする。
- manager/adminだけが実行できる。

### 履歴

`GET /api/leads/{leadId}/opportunity/history?page=1&limit=20`

- `createdAt desc, id desc` の安定順でserver paginationする。
- 履歴には変更者のID・表示名、source、from/to、reason、snapshotを返す。

### エラー

| HTTP | 条件 |
|---:|---|
| 400 | 金額、確度、予定日、失注理由などの入力不正 |
| 403 | roleまたは担当範囲外の操作 |
| 404 | LeadまたはOpportunityが存在しない |
| 409 | 禁止遷移、同じ状態、version競合、operationKey重複。競合時は現在stageとversionを返す |

`operationKey` が同じ再送は、同じ結果が保存済みなら既存結果を返し、内容が異なる場合は409にする。

## 権限

手動の商談更新は認証contextから変更者を取得し、リクエスト本文のユーザーIDを信用しない。system連動だけは `source = system` とし、利用者不在を許可する。

| role | 閲覧 | 項目更新 | 通常前方遷移 | 失注 | 受注 | 再開・担当変更 |
|---|---|---|---|---|---|---|
| viewer | 可 | 不可 | 不可 | 不可 | 不可 | 不可 |
| operator | 可 | 自分担当または未担当 | 自分担当または未担当 | 可 | 不可 | 不可 |
| manager | 可 | 全件 | 全件 | 可 | 可 | 可 |
| admin | 可 | 全件 | 全件 | 可 | 可 | 可。受注訂正も可 |
| system | 対象外 | 指定項目のみ | 外部業務イベントによる前方遷移のみ | 不可 | 不可 | 不可 |

UIを隠すだけで権限を実装した扱いにはしない。現行は認証済みprincipalを既存policyへ渡し、LA-004で全routeのrole enforcementを監査する。

## 排他・冪等性

1. 商談更新transactionの最初に `opportunity:{id}` のDB advisory lockを取得する。
2. APIは `expectedVersion` を必須にし、現在versionと一致しなければ409を返す。
3. `Opportunity` 更新と `OpportunityStageHistory` 作成は同じtransactionで行う。
4. `operationKey` を一意にし、二重クリック・再送・並行処理で履歴を重複作成しない。
5. メール送信・返信記録からの自動遷移は `mail-sent:{emailId}`、`reply:{replyId}` の安定したoperationKeyを使う。
6. version競合時に後勝ち上書きをせず、画面へ再読込を求める。

## 既存Leadの移行

### 対象

- `SalesLead.deletedAt IS NULL` の全件にOpportunityを1件作る。
- 削除済みLeadは作成しない。
- migration完了後、非削除Lead数とOpportunity数が一致することを検査する。

### 初期stageの決定順

次の順で最初に一致したものを使う。`LeadStatus` だけでなく、送信・返信のDB正本を優先する。

1. `LeadStatus = archived`、Company block、または登録済み連絡先が1件以上あり全件unsubscribeは `excluded`
2. `LeadStatus = meeting_candidate` または `meeting_request` の返信履歴ありは `meeting`
3. `not_interested` の返信履歴ありは `lost` とし、`lossReason = no_interest` を設定
4. その他の `EmailReply` あり、または `LeadStatus = replied` は `replied`
5. `OutreachEmail.sentAt` あり、`OutreachEmail.status = sent`、`SalesLead.sentAt` あり、または `LeadStatus IN (contacted, no_response)` は `contacted`
6. それ以外は `uncontacted`

`LeadStatus = rejected` はメールレビュー棄却にも使われているため、それだけで `lost` / `excluded` にしない。block・unsubscribe・送信履歴を見て上記ルールで決める。既存データから `proposal`、`won`、`lost` を推測しない。

### 初期履歴

- Opportunity作成と同時に `fromStage = null`、`toStage = 初期stage` の履歴を1件作る。
- `source = migration`
- `reason = legacy_backfill`
- `operationKey = migration:opportunity:{leadId}`
- 既存データから判断した根拠を `snapshot` に保存する。

### 段階的deploy

1. enum、table、index、relationを追加するmigrationを適用する。
2. 同じmigrationまたは専用scriptで既存Leadをbackfillする。
3. Lead数、Opportunity数、履歴数、stage別件数を検査する。
4. 新APIをdeployし、既存Lead APIは変更しない。
5. UIをOpportunity APIへ接続する。
6. メール送信・返信記録の自動前方遷移を最後に有効化する。

## rollback

- Opportunityは追加modelであり、既存 `SalesLead`、`OutreachEmail`、`EmailReply`、`Task` の値を移動・削除しない。
- APIまたはUIに問題があれば新routeと自動連動を無効化し、既存Lead画面へ戻す。これを第一のrollbackとする。
- DB rollback前にOpportunityと履歴をCSV/JSONで退避する。
- 追加tableはアプリrollback時には削除しない。安定確認後の別作業でのみ、外部キー、履歴table、Opportunity table、追加enumの順に削除する。
- rollback後も既存Leadのメール作成、送信記録、返信、次回対応は動作する。
- 本番で商談更新を開始した後のdown migrationは履歴を失うため、バックアップ確認なしで実行しない。

## SO-005の実装境界

### leads module

- `domain/opportunity-policy.ts`: 遷移、必須項目、確度、権限の純粋policy
- `domain/opportunity.repository.ts`: DB境界の契約
- `application/update-opportunity.usecase.ts`
- `application/transition-opportunity.usecase.ts`
- `application/reopen-opportunity.usecase.ts`
- `application/list-opportunities.usecase.ts`
- `infrastructure/prisma-opportunity.repository.ts`
- `opportunities.controller.ts` / DTO

### mail連動

- mailからleadsのusecaseを呼び、送信済み・返信記録を前方遷移へ反映する。
- mail domainからPrismaやleads infrastructureを直接importしない。
- 既存メール・返信transactionと商談更新を原子化できるrepository境界を使う。

### UI

- `/leads-view` の選択案件詳細へ現在stage、担当、確度、金額、予定日、失注理由、履歴を表示する。
- 一覧の既存Lead状態表示は残し、別列で商談stageを表示する。
- 状態遷移は現在状態に対して許可された操作だけを表示する。
- 受注・失注・対象外は確認dialogと理由入力を必須にする。
- version競合時は上書きせず、再読込して差分を確認させる。

## SO-005の必須検証

### domain単体テスト

- 全正常遷移
- 同状態、後方遷移、終端状態からの通常遷移拒否
- 受注金額、失注理由、other詳細、確度範囲
- role別の許可・拒否
- systemが前方遷移だけ行えること

### application単体テスト

- 項目更新とversion増加
- 状態更新と履歴作成の順序
- operationKey再送の冪等性
- メール送信・返信から後段stageを巻き戻さないこと
- 拒否時にOpportunity、履歴、Lead、Taskを変更しないこと

### 実DB integration

- 非削除LeadとOpportunityの1対1
- 状態更新と履歴の同一transaction
- 同時更新の一方だけが成功し、他方が409になること
- 同じoperationKeyで履歴が重複しないこと
- lostで理由が保存され、再読込後も一致すること
- terminal遷移で次回対応がクリアされ、未完了Taskがcancelledになること
- backfillの件数一致と初期stage決定

### API契約テスト

- server paginationとfilter
- 既存 `/api/leads`、`/api/mails`、`/api/replies` 契約が変わらないこと
- HTTP 400 / 403 / 404 / 409の条件

## 対象外

- 契約書、請求、入金、キックオフ管理
- 見積書・提案書のファイル生成
- Google Calendarへの面談自動登録
- AIによる受注・失注の自動確定
- Gmail返信自動同期
- 実メール自動送信の有効化

これらはOpportunityの状態を利用できるが、`SO-005` へ同時に追加しない。
