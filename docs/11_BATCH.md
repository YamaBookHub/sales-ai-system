# 11_BATCH.md - バッチ・キュー 実装仕様

## 1. 目的
営業候補収集、スコアリング、メール送信、返信同期、トラッキング集計を非同期処理として安定実行する。

## 2. 採用技術
- Queue: BullMQ
- Broker: Redis
- Scheduler: NestJS Schedule / BullMQ repeatable jobs
- DB: PostgreSQL + Prisma
- Worker: NestJS standalone worker

## 3. キュー一覧
| Queue | Job | 用途 | 冪等キー |
|---|---|---|---|
| scraping | collect-projects | 対象サイト案件取得 | platform+url |
| scoring | score-lead | lead評価 | leadId+version |
| mail | send-mail | Gmail送信 | emailId |
| mail | retry-mail | 失敗メール再送 | emailId+retryCount |
| gmail-sync | sync-replies | Gmail返信取得 | gmailMessageId |
| tracking | aggregate-events | 開封/クリック集計 | date+emailId |
| ai | generate-mail | AI文面生成 | leadId+templateKey |
| ai | classify-reply | 返信分類 | replyId |

## 4. ディレクトリ構成
```text
src/jobs/
├── queues.ts
├── workers/
│   ├── mail.worker.ts
│   ├── ai.worker.ts
│   ├── scoring.worker.ts
│   ├── scraping.worker.ts
│   └── gmail-sync.worker.ts
├── producers/
│   ├── mail.producer.ts
│   └── ai.producer.ts
└── processors/
    ├── send-mail.processor.ts
    ├── generate-mail.processor.ts
    └── classify-reply.processor.ts
```

## 5. スケジュール
| 処理 | 頻度 | 備考 |
|---|---|---|
| 案件収集 | 1日2回 | 9:00/18:00 |
| リードスコア再計算 | 1日1回 | 8:30 |
| 送信キュー処理 | 平日10:00-17:00 | rate limitあり |
| Gmail返信同期 | 15分ごと | threadId基準 |
| 失敗メール再送 | 30分ごと | 最大3回 |
| 監査ログ圧縮 | 1日1回 | 夜間 |

## 6. メール送信Rate Limit
初期値は安全側に倒す。

```ts
const MAIL_RATE_LIMIT = {
  maxPerMinute: 5,
  maxPerHour: 60,
  maxPerDay: 300,
  businessHoursOnly: true,
};
```

## 7. リトライ方針
| エラー | retry | backoff |
|---|---:|---|
| Gmail 429 | 3 | exponential |
| Gmail 5xx | 3 | exponential |
| network timeout | 3 | exponential |
| invalid recipient | 0 | none |
| unsubscribe | 0 | none |
| schema invalid | 0 | none |

## 8. Dead Letter Queue
最大リトライ超過時はDLQに移動し、`EmailEvent(type=failed)` と `AuditLog` を保存する。

## 9. 冪等性
- `send-mail` は `email.status` が `approved` または `queued` の場合のみ実行
- `gmailMessageId` が既に存在する場合は二重送信しない
- `sync-replies` は `gmailMessageId` uniqueで重複保存を防止
- `TrackedLink.token` はunique

## 10. Codex実装指示
WorkerはAPIプロセスと分離可能な構成にする。まずは同一NestJSアプリ内で実行できる形でよいが、`npm run worker` で独立起動できるようにする。
