# Database仕様

## 1. 正本と適用範囲

- Prisma schemaの正本は `prisma/schema.prisma` とする。
- この文書は、現行schemaのenum、model、主要制約を転記したものとする。
- DBはPostgreSQL、IDは `String @db.Uuid` と `@default(uuid())` を基本とする。
- この文書にないworker、Redis、認証、外部OAuthのmodelは現時点では存在しない。
- DB schemaの変更時はmigrationを追加し、この文書も同時に更新する。

## 2. Enum

| enum | 値 |
|---|---|
| `UserRole` | `admin`, `manager`, `operator`, `viewer` |
| `PlatformType` | `campfire`, `makuake`, `green_funding`, `other` |
| `ProjectStatus` | `discovered`, `active`, `ended`, `suspended`, `unknown` |
| `LeadStatus` | `discovered`, `qualified`, `drafted`, `reviewing`, `approved`, `queued`, `contacted`, `replied`, `meeting_candidate`, `rejected`, `no_response`, `archived` |
| `LeadPriority` | `high`, `medium`, `low` |
| `EmailStatus` | `draft`, `in_review`, `rejected`, `approved`, `queued`, `sending`, `sent`, `failed`, `cancelled` |
| `EmailEventType` | `created`, `generated`, `reviewed`, `rejected`, `approved`, `queued`, `sending`, `sent`, `failed`, `retried`, `opened`, `clicked`, `replied`, `unsubscribed`, `cancelled` |
| `ReplyCategory` | `interested`, `need_info`, `meeting_request`, `not_interested`, `unsubscribe`, `auto_reply`, `complaint`, `unknown` |
| `TaskStatus` | `todo`, `doing`, `done`, `cancelled` |
| `AiGenerationType` | `lead_scoring`, `email_draft`, `subject_generation`, `reply_classification`, `project_summary`, `next_action` |
| `AiUsageStatus` | `reserved`, `completed`, `failed` |
| `AttachmentType` | `proposal_pdf`, `lp_url`, `video_url`, `case_study_url`, `other` |
| `OpportunityStage` | `uncontacted`, `contacted`, `replied`, `meeting`, `proposal`, `won`, `lost`, `excluded` |
| `OpportunityLossReason` | `no_interest`, `no_budget`, `timing`, `no_response`, `competitor`, `service_mismatch`, `contact_unavailable`, `duplicate`, `other` |
| `OpportunityChangeSource` | `manual`, `system`, `migration` |

値は大文字へ変換せず、上表のlowercase値をPrisma ClientとAPIで使用する。

## 3. Model

以下の型表記では、`?` はnullable、`[]` は配列を表す。`DateTime` のdefaultはDB作成時、`updatedAt` はPrismaの更新時に設定される。

### 3.1 `User`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `email` | `String @unique` |
| `name` | `String?` |
| `role` | `UserRole @default(operator)` |
| `isActive` | `Boolean @default(true)` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |
| `deletedAt` | `DateTime?` |

Relation: `AuditLog[]`, `Task[]`, 承認者としての `OutreachEmail[]`。
Index: `[role, isActive]`。

### 3.1.1 RBAC・session監査

`UserRole`は `admin`、`manager`、`operator`、`viewer` の4値を持つ。認証済みrequestのactorは`User.id`と`UserSession.id`から確定し、request bodyや任意headerから利用者を選択しない。

`AuditLog`は重要操作の正本であり、`sessionId String? @db.Uuid` を持つ。既存migration/seed行ではsessionIdがnullでもよい。検索用indexは `[userId, createdAt]`、`[sessionId, createdAt]`、`[action, createdAt]` を持つ。`before`/`after`は安全な最小snapshotに限定し、メール本文、AI入力、token、secretを保存しない。

### 3.2 `CrowdfundingPlatform`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `type` | `PlatformType` |
| `name` | `String` |
| `baseUrl` | `String` |
| `isActive` | `Boolean @default(true)` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |

Relation: `CrowdfundingProject[]`。
Unique: `[type, baseUrl]`。

### 3.3 `Company`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `name` | `String` |
| `normalizedName` | `String?` |
| `websiteUrl` | `String?` |
| `inquiryUrl` | `String?` |
| `industry` | `String?` |
| `location` | `String?` |
| `sourceTotalAmount` | `Int?` |
| `sourceProjectCount` | `Int?` |
| `sourceSupporterCount` | `Int?` |
| `memo` | `String?` |
| `isBlocked` | `Boolean @default(false)` |
| `blockedReason` | `String?` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |
| `deletedAt` | `DateTime?` |

Relation: `ContactPerson[]`, `CrowdfundingProject[]`, `SalesLead[]`, `OutreachEmail[]`。
Index: `name`, `normalizedName`, `isBlocked`。

### 3.4 `ContactPerson`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `companyId` | `String @db.Uuid` |
| `name` | `String?` |
| `email` | `String?` |
| `inquiryUrl` | `String?` |
| `roleTitle` | `String?` |
| `isPrimary` | `Boolean @default(false)` |
| `isUnsubscribed` | `Boolean @default(false)` |
| `unsubscribedAt` | `DateTime?` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |
| `deletedAt` | `DateTime?` |

Relation: `Company`, `OutreachEmail[]`。
Index: `companyId`, `email`, `isUnsubscribed`。

### 3.5 `CrowdfundingProject`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `platformId` | `String @db.Uuid` |
| `companyId` | `String? @db.Uuid` |
| `title` | `String` |
| `url` | `String @unique` |
| `status` | `ProjectStatus @default(unknown)` |
| `amount` | `Int @default(0)` |
| `supporterCount` | `Int @default(0)` |
| `targetAmount` | `Int?` |
| `startDate` | `DateTime?` |
| `endDate` | `DateTime?` |
| `daysLeft` | `Int?` |
| `description` | `String?` |
| `category` | `String?` |
| `location` | `String?` |
| `thumbnailUrl` | `String?` |
| `scrapedAt` | `DateTime?` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |
| `deletedAt` | `DateTime?` |

Relation: `CrowdfundingPlatform`, `Company?`, `SalesLead[]`。
Index: `platformId`, `companyId`, `status`, `[amount, supporterCount]`, `endDate`, `daysLeft`, `location`。

### 3.6 `SalesLead`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `companyId` | `String @db.Uuid` |
| `projectId` | `String? @db.Uuid` |
| `status` | `LeadStatus @default(discovered)` |
| `priority` | `LeadPriority @default(medium)` |
| `score` | `Int @default(0)` |
| `reason` | `String?` |
| `source` | `String @default("manual")` |
| `ownerMemo` | `String?` |
| `contactEmail` | `String?` |
| `contactFormUrl` | `String?` |
| `siteMessageUrl` | `String?` |
| `contactMemo` | `String?` |
| `sendMethod` | `String?` |
| `sentAt` | `DateTime?` |
| `nextFollowUpAt` | `DateTime?` |
| `brandWebsiteUrl` | `String?` |
| `instagramUrl` | `String?` |
| `tiktokUrl` | `String?` |
| `xUrl` | `String?` |
| `brandAnalysisMemo` | `String?` |
| `snsAnalysisMemo` | `String?` |
| `nextActionAt` | `DateTime?` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |
| `deletedAt` | `DateTime?` |

Relation: `Company`, `CrowdfundingProject?`, `OutreachEmail[]`, `Task[]`, `LeadScore[]`, `AiGeneration[]`。
Unique: `[companyId, projectId]`。Index: `[status, priority]`, `score`, `nextActionAt`。

### 3.7 `Opportunity`

`Opportunity`は非削除の`SalesLead`と1対1で対応し、商談の現在段階・担当・確度・金額・予定日・受注／失注情報を保持する。候補発見、メール下書き、送信、返信分類は引き続き`SalesLead`、`OutreachEmail`、`EmailReply`を正本とする。

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `leadId` | `String @unique @db.Uuid` |
| `ownerId` | `String? @db.Uuid` |
| `stage` | `OpportunityStage @default(uncontacted)` |
| `probability` | `Int @default(0)`（0〜100） |
| `expectedAmount` | `Int?`（円、0以上） |
| `wonAmount` | `Int?`（円、0以上） |
| `meetingScheduledAt` | `DateTime?` |
| `expectedCloseDate` | `DateTime?` |
| `wonAt` | `DateTime?` |
| `lostAt` | `DateTime?` |
| `lossReason` | `OpportunityLossReason?` |
| `lossReasonDetail` | `String?` |
| `stageChangedAt` | `DateTime @default(now())` |
| `version` | `Int @default(1)` |
| `createdAt` / `updatedAt` | `DateTime` |

Relation: `SalesLead`, optional owner `User`, `OpportunityStageHistory[]`。Index: `[stage, updatedAt]`, `[ownerId, stage]`, `expectedCloseDate`。DB CHECK制約とdomain policyの両方で確度・金額を検証する。

### 3.8 `OpportunityStageHistory`

状態変更の追記専用履歴。更新・削除APIは提供しない。

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `opportunityId` | `String @db.Uuid` |
| `fromStage` | `OpportunityStage?` |
| `toStage` | `OpportunityStage` |
| `changedById` | `String? @db.Uuid` |
| `source` | `OpportunityChangeSource @default(manual)` |
| `sourceId` | `String?` |
| `reason` | `String?` |
| `operationKey` | `String? @unique` |
| `versionAfter` | `Int` |
| `snapshot` | `Json?` |
| `createdAt` | `DateTime @default(now())` |

Relation: `Opportunity`、変更者 `User`。Index: `[opportunityId, createdAt]`、`[toStage, createdAt]`、`[changedById, createdAt]`。`operationKey`で再送を冪等化し、`snapshot`には遷移時点の担当・確度・金額・予定日・失注理由を保存する。

### Opportunityの整合性ルール

- `SalesLead`と`Opportunity`は責務を分離し、商談集計は`Opportunity.stage`を使用する。
- `leadId`は一意で、1つのSalesLeadにOpportunityは最大1件。
- `expectedVersion`が現在versionと一致する場合だけ更新し、成功ごとにversionを増やす。競合は409。
- 通常状態遷移は前方のみ。`lost` / `excluded`は再開API、`won`は通常再開不可。
- `won`にはwonAmount、`lost`にはlossReasonが必須。`other`では詳細も必須。
- `won` / `lost` / `excluded`への遷移時はSalesLeadのnextActionAt・nextFollowUpAtを消し、未完了Taskをcancelledへ更新する。
- SalesLeadの削除時はOpportunityと履歴をCASCADE削除する。担当User削除時はowner／changedByをNULLにする。

### 3.9 `LeadScore`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `leadId` | `String @db.Uuid` |
| `amountScore` | `Int @default(0)` |
| `supporterScore` | `Int @default(0)` |
| `urgencyScore` | `Int @default(0)` |
| `fitScore` | `Int @default(0)` |
| `activityScore` | `Int @default(0)` |
| `totalScore` | `Int @default(0)` |
| `reasonJson` | `Json?` |
| `version` | `String @default("v1")` |
| `createdAt` | `DateTime @default(now())` |

Relation: `SalesLead`。Index: `leadId`, `totalScore`。

### 3.10 `OutreachEmail`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `leadId` | `String? @db.Uuid` |
| `companyId` | `String @db.Uuid` |
| `contactId` | `String? @db.Uuid` |
| `approvedById` | `String? @db.Uuid` |
| `status` | `EmailStatus @default(draft)` |
| `templateKey` | `String?` |
| `subject` | `String` |
| `body` | `String` |
| `bodyHtml` | `String?` |
| `toEmail` | `String?` |
| `destinationType` | `String?` |
| `destinationValue` | `String?` |
| `destinationKey` | `String?` |
| `ccEmails` | `String[] @default([])` |
| `bccEmails` | `String[] @default([])` |
| `gmailMessageId` | `String?` |
| `gmailThreadId` | `String?` |
| `provider` | `String @default("gmail")` |
| `scheduledAt` | `DateTime?` |
| `sentAt` | `DateTime?` |
| `approvedAt` | `DateTime?` |
| `failedReason` | `String?` |
| `retryCount` | `Int @default(0)` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |

Relation: `SalesLead?`, `Company`, `ContactPerson?`, 承認者の `User?`, `EmailEvent[]`, `EmailReply[]`, `TrackedLink[]`, `MailAttachment[]`, `AiGeneration[]`, `MailChecklistItem[]`。
Index: `status`, `leadId`, `companyId`, `[destinationKey, status]`, `gmailThreadId`, `scheduledAt`。

### 3.11 `MailTemplate`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `key` | `String @unique` |
| `name` | `String` |
| `channel` | `String @default("email")` |
| `subject` | `String?` |
| `body` | `String` |
| `description` | `String?` |
| `isActive` | `Boolean @default(true)` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |

Index: `[channel, isActive]`。

### 3.12 `MailChecklistItem`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `emailId` | `String @db.Uuid` |
| `key` | `String` |
| `label` | `String` |
| `checked` | `Boolean @default(false)` |
| `checkedAt` | `DateTime?` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |

Relation: `OutreachEmail`。Unique: `[emailId, key]`。Index: `emailId`, `checked`。

### 3.13 `EmailEvent`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `emailId` | `String @db.Uuid` |
| `type` | `EmailEventType` |
| `payload` | `Json?` |
| `ipHash` | `String?` |
| `userAgent` | `String?` |
| `createdAt` | `DateTime @default(now())` |

Relation: `OutreachEmail`。Index: `[emailId, type]`, `createdAt`。

### 3.14 `EmailReply`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `emailId` | `String @db.Uuid` |
| `gmailMessageId` | `String? @unique` |
| `fromEmail` | `String?` |
| `body` | `String` |
| `bodyText` | `String?` |
| `category` | `ReplyCategory @default(unknown)` |
| `confidence` | `Float @default(0)` |
| `summary` | `String?` |
| `nextAction` | `String?` |
| `receivedAt` | `DateTime @default(now())` |
| `createdAt` | `DateTime @default(now())` |

Relation: `OutreachEmail`。Index: `emailId`, `category`, `receivedAt`。

### 3.15 `TrackedLink`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `emailId` | `String @db.Uuid` |
| `token` | `String @unique` |
| `originalUrl` | `String` |
| `label` | `String?` |
| `createdAt` | `DateTime @default(now())` |

Relation: `OutreachEmail`, `LinkClick[]`。Index: `emailId`。

### 3.16 `LinkClick`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `linkId` | `String @db.Uuid` |
| `ipHash` | `String?` |
| `userAgent` | `String?` |
| `referer` | `String?` |
| `clickedAt` | `DateTime @default(now())` |

Relation: `TrackedLink`。Index: `linkId`, `clickedAt`。

### 3.17 `MailAttachment`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `emailId` | `String @db.Uuid` |
| `type` | `AttachmentType @default(other)` |
| `name` | `String` |
| `url` | `String` |
| `mimeType` | `String?` |
| `sizeBytes` | `Int?` |
| `createdAt` | `DateTime @default(now())` |

Relation: `OutreachEmail`。Index: `emailId`, `type`。

### 3.18 `AiGeneration`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `leadId` | `String? @db.Uuid` |
| `emailId` | `String? @db.Uuid` |
| `type` | `AiGenerationType` |
| `provider` | `String` |
| `model` | `String` |
| `promptVersion` | `String` |
| `inputJson` | `Json` |
| `outputJson` | `Json` |
| `latencyMs` | `Int?` |
| `tokenInput` | `Int?` |
| `tokenOutput` | `Int?` |
| `costUsd` | `Decimal? @db.Decimal(12, 6)` |
| `createdAt` | `DateTime @default(now())` |

Relation: `SalesLead?`, `OutreachEmail?`。Index: `type`, `leadId`, `emailId`, `createdAt`。

### 3.19 `AiUsageLedger`

OpenAI月額予算の同時実行予約と概算費用を管理する。生成内容やAPIキーは保存しない。

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `provider` | `String` |
| `model` | `String` |
| `operation` | `String` |
| `status` | `AiUsageStatus @default(reserved)` |
| `estimatedCostUsd` | `Decimal @db.Decimal(12, 6)` |
| `actualCostUsd` | `Decimal? @db.Decimal(12, 6)` |
| `createdAt` | `DateTime @default(now())` |
| `completedAt` | `DateTime?` |

Index: `[provider, createdAt, status]`。予算判定時はPostgreSQL advisory lockで予約作成を直列化する。

### 3.17 `Task`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `leadId` | `String? @db.Uuid` |
| `assigneeId` | `String? @db.Uuid` |
| `title` | `String` |
| `description` | `String?` |
| `status` | `TaskStatus @default(todo)` |
| `dueAt` | `DateTime?` |
| `doneAt` | `DateTime?` |
| `createdAt` | `DateTime @default(now())` |
| `updatedAt` | `DateTime @updatedAt` |

Relation: `SalesLead?`, `User?`。Index: `[status, dueAt]`, `leadId`, `assigneeId`。

### 3.18 `AuditLog`

| フィールド | 型 / default |
|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` |
| `userId` | `String? @db.Uuid` |
| `sessionId` | `String? @db.Uuid` |
| `action` | `String` |
| `entityType` | `String` |
| `entityId` | `String?` |
| `before` | `Json?` |
| `after` | `Json?` |
| `ipHash` | `String?` |
| `userAgent` | `String?` |
| `createdAt` | `DateTime @default(now())` |

Relation: `User?`。Index: `[entityType, entityId]`, `action`, `createdAt`, `[userId, createdAt]`, `[sessionId, createdAt]`, `[action, createdAt]`。

## 4. 実装済み・未実装・将来要件

### 4.1 実装済み

- 上記enum/modelと、対応するmigration 7件が存在する。
- CAMPFIRE/Makuakeのproject取得・正規化・import、Company/Lead保存、重複URLと `[companyId, projectId]` の制約を利用した重複防止がある。
- Leadのscore計算、Task、AI分析・メール下書き・返信分類、MailTemplate、MailChecklistItem、TrackedLink/LinkClickがAPIから利用できる。
- `EmailEvent` はメール状態遷移、送信claim、追跡イベントの履歴に使われる。`AuditLog` は重要操作をactor/session付きで記録し、業務履歴とは別の監査正本として扱う。
- AI生成メールは `draft` として保存し、実送信は人間のreview/承認/checklistを通過したメールに限定する。
- `Company.isBlocked`、`ContactPerson.isUnsubscribed`、正規化送信先、既存送信履歴をまとめて検査する共通guardを、下書き・レビュー・手動送信記録・実送信へ適用済み。

### 4.2 未実装または未完了

- `UserSession`、`User.googleSubject`、opaque Cookie session、current user、Google OAuth/OIDC、認証guard、単一組織内のrole別RBACは実装済み。組織scopeは未実装。
- Redis、共有queue、worker、scheduler、DLQ、送信予約の自動実行に対応するmodel/module/scriptはない。
- `OutreachEmail` のprovider送信はGmail OAuthの最小実装のみ。provider側の真の冪等性、外部APIの一般的retry方針、送信監査の詳細化は未完了。
- すべての重要操作をcurrent user/sessionに紐づけたAuditLogへ記録する仕組みはLA-004で実装済み。監査本文にはメール本文、AI入力、token、secretを保存しない。

### 4.3 将来要件

- Organization、Membership、組織単位のRBACと全read/write/export/jobのscope（LA-007）。
- worker/Redis/DLQを含む共有queueと、本番送信を再開する場合のrate limit・retry・冪等性。
- 面談、提案、契約、請求、SNS分析、収集job履歴などの専用model。現時点ではschemaに追加しない。

## 5. Soft deleteと個人情報

`deletedAt` があるmodelは `User`、`Company`、`ContactPerson`、`CrowdfundingProject`、`SalesLead` の5つだけである。`OutreachEmail`、`TrackedLink`、`Task`、履歴modelに `deletedAt` はないため、古いsoft delete仕様をこれらへ適用しない。

`EmailEvent.ipHash`、`LinkClick.ipHash`、`AuditLog.ipHash` は平文IPではなくhashを保存するためのnullableフィールドである。保存値と保管期間、AIへ渡す個人情報の範囲は運用・法務確認を要する。

## 6. Migrationと運用

現在のmigrationは次の11件である。

- `20260708000000_init`
- `20260709000000_mail_checklist`
- `20260709001000_mail_rejection`
- `20260709002000_lead_sales_management`
- `20260711000000_project_source_metrics`
- `20260712000000_mail_templates`
- `20260718000000_contact_eligibility_destination`
- `20260718010000_opportunity_pipeline`
- `20260719000000_structured_lead_analysis`
- `20260719120000_openai_budget_guard`
- `20260720000000_authentication_sessions`
- `20260720090000_rbac_audit_session`

検証は `npm run prisma:validate` を使用する。開発DBへの反映は既存の `npm run prisma:migrate`、client生成は `npm run prisma:generate` を使用する。本番のmigration deploy専用scriptはまだpackage scriptsにないため、未実装のscript名を前提にしない。
