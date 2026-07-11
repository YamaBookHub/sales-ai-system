# 24_SALES_LIST_DATA_MAPPING

## 目的

営業案件一覧の「今対応する理由」、状態サマリー、「今日の営業」が同じdataと判定順を再利用するための対応表。

UI内で新しい営業スコアを計算しない。`score`、`priority`、`status` はbackendが返す値を表示する。日時や状態から表示理由を選ぶ処理は、後続タスクで純粋なdashboard view modelへ置く。

## 現在のAPIで利用できるdata

### `GET /api/leads`

`LeadsService.list()` はLead本体に `company`、`project.platform`、最新1件の `scores` を含める。

| 用途 | Field | 未取得時の表示 |
|---|---|---|
| Lead状態 | `status` | `未判定` |
| 優先度 | `priority` | `中`ではなく`未判定`。通常はDB defaultが入る |
| backend計算済み点数 | `score` | `0` |
| 取り込み理由 | `reason` | 表示しない |
| 次の対応日時 | `nextActionAt` | `未設定` |
| 次回フォロー | `nextFollowUpAt` | `未設定` |
| 最終送信日時 | `sentAt` | `未送信` |
| 連絡メール | `contactEmail` | 他の連絡手段を確認 |
| 問い合わせフォーム | `contactFormUrl` | 他の連絡手段を確認 |
| サイトDM | `siteMessageUrl` | 他の連絡手段を確認 |
| 推奨送信方法 | `sendMethod` | `手段未定` |
| 会社名 | `company.name` | `companyId` |
| 案件名 | `project.title` | `案件名なし` |
| 取得元 | `project.platform.type` | URLから補助判定。それも不可なら`不明` |
| 支援額 | `project.amount` | `未取得`。DB defaultの0と実額0をUIで断定しない |
| 支援者数 | `project.supporterCount` | `未取得`。DB defaultの0と実数0をUIで断定しない |
| 目標額 | `project.targetAmount` | `未取得` |
| 終了日 | `project.endDate` | `未取得` |
| 残り日数 | `project.daysLeft` | `endDate`から純粋関数で補助。それも不可なら`未取得` |
| 公開状態 | `project.status` | `不明` |
| 最新score内訳 | `scores[0]` | 内訳なし |

### `GET /api/mails`

dashboardはすでにLead一覧と並行取得し、`leadId`で最新メールを結合している。

| 用途 | Field | 未取得時の表示 |
|---|---|---|
| 最新メール状態 | `status` | `未生成` |
| 作成日時 | `createdAt` | 表示しない |
| 送信日時 | `sentAt` | Leadの`sentAt`も確認 |
| 失敗理由 | `failedReason` | `理由未取得` |

この結合のためにLead APIへmailを重複追加しない。

## 現在の一覧APIだけでは不足するdata

### 返信有無

`EmailReply` modelと返信記録処理は存在するが、`GET /api/leads`にも`GET /api/mails`にもreply countまたは最新replyは含まれない。

後続の別タスク候補:

- `GET /api/mails`へ `replyCount`、`latestReplyAt`、`latestReplyCategory` を追加する。
- またはReply Inbox用queryを作り、一覧向けsummaryを返す。

返信dataが追加されるまでは「返信なし」と断定せず、一覧では返信理由を表示しない。

### 資料閲覧

`GET /api/t/mails/:emailId/engagement` では次を取得できる。

- `materialViewed`
- `materialClickCount`
- `lastMaterialClickAt`
- `appointmentAngle`

ただしメール単位endpointなので、一覧から全メールへ個別リクエストしない。

後続の別タスク候補:

- 複数mail IDまたはlead IDを受け取るbatch engagement endpointを追加する。
- または`GET /api/mails`へ資料閲覧summaryを集約する。

現状でも資料クリック時にbackendがLeadの `score`、`priority`、`status`、`nextActionAt` を更新する。そのため優先度には反映されるが、一覧で「資料を見たため」と断定する表示は集約API追加後に行う。

## 「今対応する理由」の決定順

後続の純粋view modelは、利用可能なsignalを上から1つ選ぶ。複数理由を足して新しいscoreを作らない。

1. 返信あり: 集約API追加後に使用
2. 資料閲覧あり: 集約API追加後に使用
3. `nextActionAt` が期限超過または今日
4. `nextFollowUpAt` が期限超過または今日
5. 最新mailが `failed`: `送信失敗を確認`
6. 最新mailが `rejected`: `本文を修正して再レビュー`
7. 最新mailが `in_review`: `レビュー結果を確認`
8. 最新mailが `approved`: `送信待ちにする`
9. 最新mailが `draft`: `下書きを確認`
10. 連絡手段がない: `連絡先を確認`
11. projectの終了日が近い: `終了日が近い`
12. `reason` がある: backendの取り込み理由を短く表示
13. それ以外: `次の対応を設定`

`queued`、`sending`、`sent`、`cancelled` は新しい遷移をUIで作らず、現在状態を表示する。今日・期限超過の判定は `Asia/Tokyo` を明示した純粋関数で行う。

## 再利用先

### UX-F01

- `nextActionAt`、`nextFollowUpAt`、最新mail status、返信有無を`leads/domain/today-sales.ts`で分類する。
- 日付の比較は`Asia/Tokyo`の`YYYY-MM-DD`へ正規化して行う。
- 分類は期限、返信、送信失敗、下書き、承認、送信待ちの順で1つだけ返す。scoreは計算しない。

### UX-E01

- Leadの `status`、`priority`
- contact fieldsの有無
- `GET /api/mails`から結合した最新mail status

### UX-E03

- この文書の「今対応する理由」の決定順
- 1行につき主理由1つ
- score再計算は禁止

### UX-F01

- `nextActionAt`
- `nextFollowUpAt`
- 最新mail status
- Lead status
- `Asia/Tokyo`の日付境界

## 根拠となる実装

- `apps/api/src/leads/leads.service.ts`: Lead一覧のinclude
- `prisma/schema.prisma`: `SalesLead`、`CrowdfundingProject`、`OutreachEmail`、`EmailReply`
- `apps/api/src/mail/mail.service.ts`: Mail一覧と返信記録
- `apps/api/src/tracking/tracking.service.ts`: 資料閲覧summaryとLead反映
