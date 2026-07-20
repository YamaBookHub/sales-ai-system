# 06_API.md

## API実装仕様

### 共通

- NestJS REST API。global prefix は `api`。
- ただし `GET /`、`GET /leads-view`、`GET /mail-workspace`、`GET /today`、`GET /sales-performance`、`GET /replies`、`GET /health`、`GET /t/open/{emailId}.png`、`GET /t/click/{token}` は `/api` 外。
- JSONレスポンスは原則 `{ data, meta, error }`。成功時は `error: null`、`meta` は原則 `null`。
- HTML画面と開封計測画像、クリックリダイレクトはこのwrapperの対象外。
- page/limit はcontrollerが数値化する。既定値は `page=1`、`limit=20`。Reply Inboxのlimit上限は100。
- `GET /health`、`GET /login`、Google認証開始/callback、local限定login、開封画像、クリックredirect以外はsession認証が必須。
- ブラウザ認証はserver管理のopaque session Cookieを使う。JWTや任意の利用者headerは使用しない。
- 認証済みのPOST/PATCH/DELETEは、同一originに加えて `GET /api/auth/me` が返す `csrfToken` を `X-CSRF-Token` headerで送る。
- 認証エラーは401、CSRF・利用停止・許可されていないログインは403。保護画面の未認証アクセスは `/login` へredirectする。

## 認証

| Method | Path | 認証 | 用途 |
|---|---|---|---|
| GET | `/login` | 公開 | ログイン画面 |
| GET | `/api/auth/google/start` | 公開 | Google OAuth/OIDC開始 |
| GET | `/api/auth/google/callback` | 公開 | callback検証とsession発行 |
| POST | `/api/auth/local-login` | local限定公開 | 固定した既存active userのsession発行 |
| GET | `/api/auth/me` | 必須 | current user、CSRF token、session絶対期限 |
| POST | `/api/auth/logout` | 必須 + CSRF | current session失効 |

local loginは `APP_ENV=local`、`AUTH_MODE=local`、loopback origin、`AUTH_DEV_USER_EMAIL` の既存active userという全条件を要求し、requestから利用者を選択できない。

## 画面・health

| Method | Path | Query | Body | 用途 |
|---|---|---|---|---|
| GET | `/` | - | - | URL検索画面HTML |
| GET | `/leads-view` | - | - | 案件一覧画面HTML |
| GET | `/mail-workspace` | - | - | メール画面HTML |
| GET | `/today` | - | - | 今日の対応画面HTML |
| GET | `/sales-performance` | - | - | 営業成績画面HTML |
| GET | `/replies` | - | - | 返信一覧画面HTML |
| GET | `/health` | - | - | `{ data: { status: "ok" }, meta, error }` |

## Company / Project API

| Method | Path | Query / Header | Body |
|---|---|---|---|
| GET | `/api/companies` | `page`, `limit` | - |
| POST | `/api/companies` | - | `CreateCompanyDto` |
| POST | `/api/companies/{id}/block` | path `id` | `BlockCompanyDto` |
| GET | `/api/projects` | `page`, `limit`, `status` | - |
| POST | `/api/projects` | - | `CreateProjectDto` |
| POST | `/api/projects/import/campfire` | - | `ImportCampfireProjectDto` |
| POST | `/api/projects/import` | - | `ImportProjectDto` |
| POST | `/api/projects/bulk-import` | - | `BulkImportProjectsDto` |
| GET | `/api/projects/categories/campfire` | - | - |
| GET | `/api/projects/categories` | `source`（既定 `campfire`） | - |
| POST | `/api/projects/search/campfire` | - | `SearchCampfireProjectsDto` |
| POST | `/api/projects/search` | - | `SearchProjectsDto` |
| POST | `/api/projects/search-jobs` | - | `SearchProjectsDto` |
| GET | `/api/projects/search-jobs/{id}` | path `id` | - |
| POST | `/api/projects/search-jobs/{id}/cancel` | path `id` | - |

`ImportProjectDto.source` と `BulkImportProjectsDto.source` は `campfire`、`makuake`、`green_funding` のいずれか。現行providerの検索・取り込み対象外sourceはcontrollerでは受け取るが、serviceで準備中エラーになる。

`SearchCampfireProjectsDto` は `keyword`、`category`、`amountMin`、`amountMax`、`supporterMin`、`supporterMax`、`profileProjectMin`、`profileProjectMax`、`limit`、`status`、`endingSoonDays`、`excludeUrls` を任意で受け取る。`SearchProjectsDto` はこれらに任意の `source` を加える。

## Lead API

| Method | Path | Query / Header | Body |
|---|---|---|---|
| GET | `/api/leads` | `page`, `limit`, `status`, `priority` | - |
| POST | `/api/leads` | - | `CreateLeadDto` |
| GET | `/api/leads/{id}` | path `id` | - |
| PATCH | `/api/leads/{id}` | path `id` | `UpdateLeadDto` |
| POST | `/api/leads/{id}/score` | path `id` | - |

Create/Updateの入力項目は現行DTOを正とする。Lead詳細・一覧には実装により会社、案件、score履歴、`nextTask`、`activeTaskCount` 等が含まれることがある。

### Opportunity API

Opportunityは、SalesLeadの候補・メール作業状態とは分離した商談パイプラインの正本である。レスポンスは既存APIと同じ `{ data, meta, error }` wrapperを使用する。`leadId` はUUIDとして検証される。

| Method | Path | Query | Body |
|---|---|---|---|
| GET | `/api/opportunities` | `page`, `limit`, `stage`, `ownerId`, `source`, `expectedCloseFrom`, `expectedCloseTo` | - |
| GET | `/api/leads/{leadId}/opportunity` | - | - |
| PATCH | `/api/leads/{leadId}/opportunity` | - | `UpdateOpportunityDto` |
| POST | `/api/leads/{leadId}/opportunity/transitions` | - | `TransitionOpportunityDto` |
| POST | `/api/leads/{leadId}/opportunity/reopen` | - | `ReopenOpportunityDto` |
| GET | `/api/leads/{leadId}/opportunity/history` | `page`, `limit` | - |

`GET /api/opportunities` はサーバー側ページングを行う。既定値は `page=1`、`limit=20`、limitの上限は100で、Lead、会社、案件、取得元、直近の未完了Taskを含む一覧を返す。`source` は `campfire`、`makuake`、`green_funding`、`other` のいずれかである。

`GET /api/leads/{leadId}/opportunity` は商談の現在値と直近10件の状態履歴を返す。履歴を全件取得する場合はhistory routeを使用する。

`UpdateOpportunityDto` は `expectedVersion` が必須で、`ownerId`、`probability`（0〜100）、`expectedAmount`（0以上）、`meetingScheduledAt`、`expectedCloseDate` を任意で更新する。更新時はversionを比較し、成功時に1増やす。競合時は409を返す。

`TransitionOpportunityDto` は `expectedVersion`、UUIDの `operationKey`、`toStage` が必須。`reason`、`probability`、`expectedAmount`、予定日、`wonAmount`、`lossReason`、`lossReasonDetail` を任意で指定する。`won` はwonAmount、`lost` はlossReasonが必須で、lossReasonが`other`の場合はlossReasonDetailも必須。operationKeyは同じ操作の再送を冪等化し、異なる商談・状態で再利用した場合は409を返す。

`ReopenOpportunityDto` は終端状態（`lost` / `excluded`）を、明示した `toStage`（`uncontacted`〜`proposal`）へ戻す操作である。`expectedVersion`、UUIDの `operationKey`、`reason`、`toStage` が必須。`won` の通常再開は許可しない。

状態は `uncontacted` → `contacted` → `replied` → `meeting` → `proposal` → `won` または `lost` とし、営業対象外は `excluded` とする。通常操作による後方遷移・終端状態からの変更は拒否する。各遷移は`OpportunityStageHistory`へ追記され、`source`、`sourceId`、`operationKey`、変更後version、snapshotを保存する。送信済みメール・返信の記録からの自動連動は前方遷移だけを行い、提案・受注・失注を巻き戻さない。

### 営業成績API

| Method | Path | Query | Body |
|---|---|---|---|
| GET | `/api/reports/sales-performance` | `from`, `to`, `ownerId`, `source` | - |
| GET | `/api/reports/sales-performance/owners` | - | - |

`from`と`to`は`Asia/Tokyo`の営業日付を`YYYY-MM-DD`で指定し、両端を含む。省略時は当日を含む直近30暦日を使う。`source`は`campfire`、`makuake`、`green_funding`、`other`、`manual`を受け付け、`manual`は案件に紐づかない手動登録Leadを意味する。`ownerId`は現在のOpportunity担当者で絞る。

集計は期間内に実送信日時`OutreachEmail.sentAt`を持ち、送信済みイベントで裏付けられた非削除Leadを母集団とする。イベント登録日は集計日付に使わない。`sentMessages`は送信メール・サイトDM・問い合わせフォーム文面の件数、`contactedLeads`は重複を除いた営業対象数である。返信率、商談率、受注率はすべて`contactedLeads`を分母とし、実送信後に返信・商談・受注へ到達したかを集計する。返信は`EmailReply`、商談・受注到達は`OpportunityStageHistory`、現在の失注理由は`stage=lost`の`Opportunity`を正本とする。0件時の率は`0`で、画面表示中のページ件数は使用しない。

担当者候補APIは現在Opportunityを持つ利用者を返す。過去成績を確認できるよう、無効化済み利用者も`isActive: false`として含める。

### 次回対応Task API

| Method | Path | Query | Body |
|---|---|---|---|
| GET | `/api/leads/{leadId}/tasks` | `scope=active\|all`（既定 `active`） | - |
| POST | `/api/leads/{leadId}/tasks` | - | `CreateTaskDto` |
| PATCH | `/api/tasks/{taskId}` | - | `UpdateTaskDto` |
| GET | `/api/task-assignees` | - | - |

`CreateTaskDto` は `title` 必須、`description`、`dueAt`、`assigneeId` 任意。`UpdateTaskDto` はそれらと `status` を任意で受け取る。UUID pathはcontrollerの `ParseUUIDPipe` で検証する。

## Mail API

| Method | Path | Query | Body |
|---|---|---|---|
| GET | `/api/mails` | `page`, `limit`, `status` | - |
| POST | `/api/mails/draft` | - | `CreateMailDraftDto` |
| GET | `/api/mails/templates` | `channel` | - |
| GET | `/api/mails/templates/{key}` | path `key` | - |
| POST | `/api/mails/templates` | - | `SaveMailTemplateDto` |
| POST | `/api/mails/templates/import` | - | `ImportMailTemplatesDto` |
| PATCH | `/api/mails/{id}` | path `id` | `UpdateMailDto` |
| GET | `/api/mails/{id}/consistency` | path `id` | - |
| GET | `/api/mails/{id}/checklist` | path `id` | - |
| PATCH | `/api/mails/{id}/checklist` | path `id` | `UpdateMailChecklistDto` |
| POST | `/api/mails/{id}/request-review` | path `id` | - |
| POST | `/api/mails/{id}/request-rereview` | path `id` | - |
| POST | `/api/mails/{id}/approve` | path `id` | - |
| POST | `/api/mails/{id}/reject` | path `id` | `RejectMailDto` |
| POST | `/api/mails/{id}/queue` | path `id` | - |
| POST | `/api/mails/{id}/mark-sent` | path `id` | `MarkMailSentDto` |
| POST | `/api/mails/{id}/send` | path `id` | - |
| POST | `/api/mails/{id}/replies` | path `id` | `CreateMailReplyDto` |
| POST | `/api/mails/{id}/retry` | path `id` | - |
| POST | `/api/mails/{id}/cancel` | path `id` | - |
| GET | `/api/mails/threads/{gmailThreadId}` | path `gmailThreadId` | - |
| GET | `/api/replies` | `page`, `limit`, `category`, `attention`, `leadStatus`, `sort`, `direction` | - |

`GET /api/replies` のquery許容値は現行 `ReplyInboxQueryDto` を正とする。`SaveMailTemplateDto`、checklist、reject、mark-sent、replyのbody項目も現行DTOを正とする。

## AI API

| Method | Path | Body |
|---|---|---|
| GET | `/api/ai/usage-summary` | - |
| POST | `/api/ai/leads/{leadId}/generate-mail` | `GenerateMailDto` |
| POST | `/api/ai/leads/{leadId}/email-draft` | `GenerateMailDto` |
| GET | `/api/ai/leads/{leadId}/analysis` | - |
| PATCH | `/api/ai/leads/{leadId}/analysis` | `LeadAnalysisRevisionDto` |
| POST | `/api/ai/leads/{leadId}/analysis/confirm` | `LeadAnalysisRevisionDto` |
| POST | `/api/ai/leads/{leadId}/analyze` | - |
| POST | `/api/ai/mails/{mailId}/polish` | - |
| POST | `/api/ai/mails/{mailId}/semantic-consistency` | - |
| GET | `/api/ai/leads/{leadId}/generations` | - |
| POST | `/api/ai/replies/{replyId}/classify` | - |

`GenerateMailDto` は `templateKey` と、使用する確認済み分析版を指定する `analysisRevisionId`（UUID）が必須、`tone` は任意。メール生成は指定版が現在のLead・案件に属し、確認済みで、案件fingerprintが一致し、最新の利用可能な確認済み版である場合だけ成功する。未確認、案件変更によるstale、別案件、存在しない版、古いversionの場合は409で停止し、メール・Lead状態・AI生成ログを作成しない。`/api/ai/leads/{id}/next-action` は現行controllerに実装がないため、現行API routeではない。

`GET /api/ai/usage-summary` はJST当月のOpenAI概算費用を返す。`budgetUsd` は未設定時null、`spentUsd` は完了済み、`reservedUsd` は実行中、`remainingUsd` は残額、`blocked` は新しいOpenAI実行の停止状態である。APIキーやプロンプト、メール本文は返さない。

### 構造化Lead分析

LM-004では、メール生成前に次の3項目を案件単位で確認する。自由記述の営業メモや過去のAIログは、メール生成に使う分析の正本ではない。

- `appeal`: 商品・企画の魅力
- `targetUser`: 想定する相手
- `videoIdea`: 動画での見せ方

`GET /api/ai/leads/{leadId}/analysis` の `data` は次の形を返す。

| Field | 内容 |
|---|---|
| `projectId` | 現在紐づいている案件ID |
| `sourceFingerprint` | 編集開始時の案件情報を識別するfingerprint |
| `proposal` | 最新の分析版。未分析の場合はnull |
| `confirmed` | 現在案件とfingerprintが一致する最新confirmed版。なければnull |
| `history` | 直近20件の追記専用revision履歴 |
| `missingFields` | `appeal`、`targetUser`、`videoIdea` の不足項目 |
| `stale` | proposalまたはconfirmedが現在案件から古いか |
| `canGenerateMail` | 確認済み・3項目入力済み・案件一致・fingerprint一致の場合だけtrue |

`PATCH /api/ai/leads/{leadId}/analysis` と `POST /api/ai/leads/{leadId}/analysis/confirm` は、共通して次のJSONを受け取る。空欄を含む下書き保存は許可するが、確認は3項目すべてが入力済みの場合だけ成功する。`expectedVersion` が最新versionと異なる場合、`expectedSourceFingerprint` が現在案件と異なる場合、確認時に必須項目が不足している場合は409を返す。

```json
{
  "expectedVersion": 3,
  "expectedSourceFingerprint": "0123456789abcdef0123456789abcdef",
  "appeal": "商品の魅力",
  "targetUser": "想定する相手",
  "videoIdea": "短尺動画での見せ方"
}
```

分析版はLead・案件・作成元AI生成ログ・version・status（`draft` / `confirmed`）・origin（`generated` / `manual` / `migration`）・fingerprint・確認日時を保持する。分析の再生成や手動編集は既存版を上書きせず、新しいversionとして履歴に追加する。メール生成時はメール側に使用した `analysisRevisionId` を固定する。

`POST /api/mails/draft` も `analysisRevisionId` を必須とし、手動本文を保存する場合を含めて、現在案件と一致する最新の確認済み分析だけをメールへ固定する。

## Tracking API

| Method | Path | Body | 応答 |
|---|---|---|---|
| GET | `/t/open/{emailId}.png` | - | 1x1 GIF。wrapper外 |
| POST | `/api/t/links` | `CreateTrackedLinkDto` | wrapper |
| GET | `/api/t/mails/{emailId}/engagement` | - | wrapper |
| GET | `/t/click/{token}` | - | 302 redirect。wrapper外 |
| POST | `/api/unsubscribe` | `UnsubscribeDto` | wrapper |

## Response / error

成功JSONは常に `{ data, meta, error }` を維持する。`data` の具体的な形は対応するcontroller/serviceの現行戻り値、入力の形は現行DTOを正とし、未実装の `/api/ai/leads/{id}/next-action` をOpenAPIへ追加しない。Nest標準のHTTP statusはGET/PATCHが200、POSTが201、tracking redirectが302。
