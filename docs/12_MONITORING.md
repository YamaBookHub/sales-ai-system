# 12_MONITORING.md - 監視・ログ 実装仕様

## 1. 目的
営業AIシステムの送信失敗、AI失敗、Gmail同期停止、DB異常を早期発見する。

2026-07-22時点で、LO-001としてJSON構造化ログとrequest IDの基盤を実装済みである。指標の集計・保存、アラート通知、管理画面表示はLO-003で実装する。

## 2. 監視対象
| 対象 | 指標 | 閾値 |
|---|---|---|
| API | 5xx rate | 5分で5%超 |
| DB | query latency | p95 500ms超 |
| Mail | send failure rate | 1時間10%超 |
| Gmail sync | last success | 30分以上成功なし |
| AI | schema invalid rate | 1時間5件超 |
| Queue | waiting jobs | 100件超 |
| DLQ | failed jobs | 1件以上で通知 |

## 3. ログ形式
JSON構造化ログとする。

```json
{
  "timestamp":"2026-07-08T00:00:00.000Z",
  "level":"info",
  "requestId":"uuid",
  "userId":"uuid|null",
  "organizationId":"uuid|null",
  "event":"mail.sent",
  "entityType":"OutreachEmail",
  "entityId":"uuid",
  "metadata":{}
}
```

### request ID

- requestの `X-Request-Id` がUUIDの場合は引き継ぐ。
- UUIDでない値は信頼せず、サーバーでUUIDを生成する。
- 全responseに `X-Request-Id` を返す。
- `AsyncLocalStorage` でrequest中の `requestId`、認証後の `userId`、`organizationId` を引き継ぐ。

### 実装済みevent

- `http.request_completed`: 5xx未満のHTTP処理完了
- `http.request_failed`: 5xxのHTTP処理完了
- `ai.operation_failed`: OpenAI / Gemini / AI予算guardの失敗
- `scraper.search_failed`: 同期検索または検索jobのprovider検索失敗
- `scraper.import_failed`: providerからの案件取得失敗。公開状態判定やDB保存失敗は含めない
- `mail.send_failed`: 実送信providerの失敗

### metadataの許可項目

ログへ出せるmetadataは `operation`、`source`、`provider`、`method`、route template、`statusCode`、`durationMs`、安全化したerror type/code/statusだけとする。自由形式のオブジェクトやerror message/stackは出力しない。

## 4. AuditLog対象
- ユーザー作成/権限変更
- lead status変更
- email approve/cancel/send
- unsubscribe処理
- AI生成
- 重要設定変更

## 5. メトリクス
- `api_request_duration_ms`
- `mail_sent_total`
- `mail_failed_total`
- `mail_opened_total`
- `mail_clicked_total`
- `ai_generation_total`
- `ai_generation_failed_total`
- `queue_waiting_count`
- `gmail_sync_last_success_timestamp`

## 6. アラート通知先
初期実装ではSlack Webhookまたはメール通知。環境変数で切替。

```env
ALERT_WEBHOOK_URL=
ALERT_EMAIL_TO=
```

## 7. ダッシュボード
管理画面に最低限以下を表示する。
- 本日の送信数
- 失敗数
- 返信数
- 開封数
- クリック数
- AI生成失敗数
- DLQ件数

## 8. 個人情報保護
ログに本文全文、メールアドレス平文、IP平文、認証token、Cookie、Authorization header、request body、query文字列、error message/stackを出さない。HTTPログは実URLではなくroute templateだけを記録する。

Gmailの失敗response本文は例外、ログ、DBの `failedReason`、`EmailEvent` に保存しない。送信失敗理由は安全なHTTP statusまたはerror codeだけへ正規化する。

## 9. Codex実装指示
runtimeの構造化ログは `common/logging` に集約する。業務操作の証跡であるDB `AuditLog` と、障害検知用のruntime logを混同しない。LO-003ではこのevent契約を入力としてメトリクスと費用表示を追加し、本文・メール・IPを集計軸にしない。
