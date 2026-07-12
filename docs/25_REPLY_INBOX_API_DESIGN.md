# 25_REPLY_INBOX_API_DESIGN

## 目的

`UX-G01` の成果物。返信一覧（Reply Inbox）を実装する前に、現行dataで取得できる範囲と不足するAPIを固定する。

この文書は設計・監査の成果物であり、G01ではcontroller、repository、DB schema、HTMLを変更しない。

## 正本

返信機能の実装判断は、次を正本とする。

1. `prisma/schema.prisma`
2. `apps/api/src/ai/domain/reply-classifier.ts`
3. `apps/api/src/mail/mail.service.ts`
4. `apps/api/src/mail/mail.controller.ts`
5. `openapi/openapi.yaml`

`docs/09_MAIL.md` には別世代の `outreachEmailId`、`providerMessageId`、`rawBody` などを持つモデル案が残っている。現行コードと異なるため、G02以降の実装ではそのまま使用しない。

## 現在あるもの

### DB

現行の `EmailReply` は次の情報を持つ。

| Field | 用途 |
|---|---|
| `id` | 返信の一意識別子 |
| `emailId` | `OutreachEmail` への参照 |
| `gmailMessageId` | Gmail message ID。unique |
| `fromEmail` | 返信元 |
| `body` / `bodyText` | 原文・表示本文 |
| `category` | `ReplyCategory` |
| `confidence` | 分類信頼度 |
| `summary` | 分類要約 |
| `nextAction` | 次操作の助言 |
| `receivedAt` | 受信日時 |
| `createdAt` | 保存日時 |

関連して、返信一覧に必要な `OutreachEmail`、`Company`、`ContactPerson`、`SalesLead`、`CrowdfundingProject` が既存relationで取得できる。

### 既存API

| API | 現状 |
|---|---|
| `POST /api/mails/:id/replies` | 手入力した返信を保存し、既存分類を実行する |
| `GET /api/mails/threads/:gmailThreadId` | thread ID指定でメールと返信を返す |
| `POST /api/ai/replies/:replyId/classify` | 既存返信を分類し、返信とLeadを更新する |
| `GET /api/mails` | Mail一覧。返信relationは返さない |
| `GET /api/leads` | Lead一覧。返信件数・最新返信は返さない |

### 現在の分類実装

`classifyReplyText()` は `unsubscribe`、`meeting_request`、`need_info`、`not_interested`、`auto_reply`、`unknown` を返す。

enumには `interested` と `complaint` も存在するが、現在のルールからは返らない。G02で表示カテゴリとして扱う場合は、分類データが存在しないことと「分類ロジックを追加すること」を分けて実装する。

## 不足しているもの

| 不足 | 根拠 | 後続タスク |
|---|---|---|
| 返信一覧GET API | Reply専用controllerがない | G03/G04 |
| 返信のGmail同期 | senderは送信専用でthread取得・保存同期がない | G03以降の別設計 |
| `interested` 判定 | enumのみでclassifier分岐がない | G02 |
| `complaint` 判定 | enumのみでclassifier分岐がない | G02 |
| 返信受信済みの同期時刻 | `EmailReply`にはあるが、未同期を示す状態がない | G03で注記 |
| 担当者 | `SalesLead`にowner relationがなく、`Task.assigneeId`は一覧用に直結しない | G05/G06 |
| 返信による配信停止の恒久反映 | unsubscribe分類はLeadをrejectedにするが、ContactPersonの`isUnsubscribed`更新は行わない | G04以降の安全タスク |
| complaintの安全処理 | complaint分類・停止処理がない | G02/G04 |

`ContactPerson.isUnsubscribed` と `Company.isBlocked` は既に存在するが、意味が異なる。返信一覧の表示だけで自動更新せず、別の安全な書き込みUseCaseで扱う。

## 提案API

### Endpoint

```http
GET /api/replies
```

現在のAPI規約に合わせて `page` と `limit` を使う。cursor paginationは現状の画面規模では追加しない。

### Query DTO案

| Query | 型 | 初期値 | 許可値・制約 |
|---|---|---:|---|
| `page` | number | `1` | 1以上 |
| `limit` | number | `20` | 1〜100 |
| `category` | `ReplyCategory` | なし | enum値。複数指定はG04で判断 |
| `attention` | string | `all` | `all` / `needs_action` / `manager_review` / `stop_followup` |
| `leadStatus` | `LeadStatus` | なし | 現行enum値 |
| `sort` | string | `receivedAt` | `receivedAt` / `priority` / `confidence` |
| `direction` | string | `desc` | `asc` / `desc` |

`owner` filterは現行dataに担当者relationがないためG01では追加しない。不正な値はValidationPipeで400にする。

### Response DTO案

```ts
type ReplyInboxResponse = {
  items: ReplyInboxItem[];
  page: number;
  limit: number;
  total: number;
};

type ReplyInboxItem = {
  id: string;
  emailId: string;
  fromEmail: string | null;
  bodyText: string;
  category: ReplyCategory;
  categoryLabel: string;
  confidence: number;
  summary: string | null;
  nextAction: string | null;
  receivedAt: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  priorityRank: number;
  mail: {
    id: string;
    subject: string;
    status: EmailStatus;
    gmailThreadId: string | null;
    sentAt: string | null;
  };
  company: {
    id: string;
    name: string;
    isBlocked: boolean;
  };
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    isUnsubscribed: boolean;
  } | null;
  lead: {
    id: string | null;
    status: LeadStatus | null;
    priority: LeadPriority | null;
    score: number | null;
    nextActionAt: string | null;
    project: {
      id: string;
      title: string;
      url: string;
    } | null;
  };
  flags: {
    managerReviewRequired: boolean;
    stopFollowup: boolean;
    hasReply: true;
  };
};
```

一覧の1行は1件の `EmailReply` とする。thread単位の重複排除は行わず、同じthreadに複数返信があれば複数行で返す。各 `EmailReply.id` が一意なので、同じ返信を二重に返さない。

### 表示フラグの決定

DBに新しいbooleanを追加せず、repositoryの取得結果をG02のview modelで次のように変換する。

| 条件 | `managerReviewRequired` | `stopFollowup` | 次操作 |
|---|---:|---:|---|
| `category = unsubscribe` | true | true | 追客停止・配信停止を確認 |
| `category = complaint` | true | false | manager確認。通常追客は禁止 |
| `category = meeting_request` | false | false | 日程調整 |
| `category = interested` | false | false | 詳細確認・商談候補化 |
| `category = need_info` | false | false | 資料・質問へ対応 |
| `category = auto_reply` | false | false | 通常返信を待つ |
| `category = not_interested` | false | true | 追客停止 |
| `category = unknown` | true | false | 人間確認 |

`unsubscribe` と `complaint` は通常フォローを提案しない。AI分類済みでも、人間確認が必要な表示は残す。

## Repository query案

G03では `prisma.emailReply.findMany()` を起点にする。

```ts
prisma.emailReply.findMany({
  where: buildReplyInboxWhere(query),
  orderBy: buildReplyInboxOrder(query),
  skip,
  take,
  include: {
    email: {
      include: {
        company: true,
        contact: true,
        lead: { include: { company: true, project: true } }
      }
    }
  }
});
```

実装時は `select` で表示に必要なフィールドだけに絞る。本文全文を大量取得せず、一覧では `bodyText` をview model側で短くする。詳細画面で全文が必要になった場合は、G05以降で別取得を検討する。

`attention` の条件は次の優先で作る。

1. `manager_review`: `category in [unsubscribe, complaint, unknown]`
2. `stop_followup`: `category in [unsubscribe, not_interested]` または `contact.isUnsubscribed = true` または `company.isBlocked = true`
3. `needs_action`: `category in [interested, need_info, meeting_request]` または `manager_review`

## 未返信の扱い

返信一覧は `EmailReply` が存在する行を返す。未返信一覧は同じAPIのcategoryではなく、G03で別のmail queryとして扱う。

現行dataから安全に言えるのは次だけ。

- `OutreachEmail.status = sent` かつ関連 `EmailReply` が0件: `返信未確認`
- `sent` 以外: `返信待ち` とは断定しない
- Gmail同期未実装のため、`返信なし` と断定しない

## docs/06_API.md 更新案

G04で次を `Mail API` の後に追加する。

```md
| GET | /api/replies | Reply Inbox一覧 |
```

同時に、Query DTO、`ReplyInboxResponse`、`ReplyInboxItem`、400（不正filter/pagination）、200のresponse wrapperを追記する。G01では正本のAPI一覧を未実装endpointで汚さない。

## openapi/openapi.yaml 更新案

G04で次を追加する。

- `/api/replies` GET path
- `ReplyInboxQuery` parameterまたはquery parameter定義
- `ReplyInboxResponse`
- `ReplyInboxItem`
- `ReplyInboxFlags`
- `ReplyInboxMailSummary`
- `ReplyInboxLeadSummary`
- `EmailReply` schemaに現行DBの `gmailMessageId`、`body`、`receivedAt`、`createdAt` を追加

既存の `EmailReply` schemaは`bodyText`中心で、現行Prismaの `body` と一致していないため、G04で同時に正す。

## G02へ渡す入力

G02はDB・controllerなしの純粋関数として、次を実装する。

```ts
buildReplyInboxViewModel(replyRecord): ReplyInboxItem
```

テスト対象は次の8カテゴリ、`unsubscribe/complaint`のmanager確認、`stopFollowup`、会社NG・連絡先配信停止、短い本文、未知分類、東京時間の受信日時表示とする。

## G04実装結果

`apps/api/src/mail/reply-inbox.dto.ts`、`application/list-reply-inbox.usecase.ts`、`reply-inbox.controller.ts` を追加した。既存の共通 `ok()` wrapperを使い、APIは `GET /api/replies` として公開する。DTO検証はglobal `ValidationPipe`に任せ、不正なfilter・paginationは400で拒否する。

## 結論

現時点で必要なのは新しいDBモデルではなく、`EmailReply`を起点にMail・Company・Contact・Lead・Projectを一度だけ取得するReply Inbox queryである。ただし受信同期とunsubscribe/complaintの安全な書き込みは別問題なので、G03/G04で一覧APIと混ぜずに扱う。
