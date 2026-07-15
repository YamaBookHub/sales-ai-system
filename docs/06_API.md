# 06_API.md

## API実装仕様

### 共通

- NestJS REST API。global prefix は `api`。
- ただし `GET /`、`GET /leads-view`、`GET /mail-workspace`、`GET /today`、`GET /replies`、`GET /health`、`GET /t/open/{emailId}.png`、`GET /t/click/{token}` は `/api` 外。
- JSONレスポンスは原則 `{ data, meta, error }`。成功時は `error: null`、`meta` は原則 `null`。
- HTML画面と開封計測画像、クリックリダイレクトはこのwrapperの対象外。
- page/limit はcontrollerが数値化する。既定値は `page=1`、`limit=20`。Reply Inboxのlimit上限は100。

## 画面・health

| Method | Path | Query | Body | 用途 |
|---|---|---|---|---|
| GET | `/` | - | - | URL検索画面HTML |
| GET | `/leads-view` | - | - | 案件一覧画面HTML |
| GET | `/mail-workspace` | - | - | メール画面HTML |
| GET | `/today` | - | - | 今日の対応画面HTML |
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
| POST | `/api/projects/import/campfire` | header `x-operator-email` optional | `ImportCampfireProjectDto` |
| POST | `/api/projects/import` | header `x-operator-email` optional | `ImportProjectDto` |
| POST | `/api/projects/bulk-import` | header `x-operator-email` optional | `BulkImportProjectsDto` |
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
| POST | `/api/ai/leads/{leadId}/generate-mail` | `GenerateMailDto` |
| POST | `/api/ai/leads/{leadId}/email-draft` | `GenerateMailDto` |
| POST | `/api/ai/leads/{leadId}/analyze` | - |
| POST | `/api/ai/mails/{mailId}/polish` | - |
| POST | `/api/ai/mails/{mailId}/semantic-consistency` | - |
| GET | `/api/ai/leads/{leadId}/generations` | - |
| POST | `/api/ai/replies/{replyId}/classify` | - |

`GenerateMailDto` は `templateKey` 必須、`tone` 任意。`/api/ai/leads/{id}/next-action` は現行controllerに実装がないため、現行API routeではない。

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
