# 12_MONITORING.md - 監視・ログ 実装仕様

## 1. 目的
営業AIシステムの送信失敗、AI失敗、Gmail同期停止、DB異常を早期発見する。

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
  "event":"mail.sent",
  "entityType":"OutreachEmail",
  "entityId":"uuid",
  "metadata":{}
}
```

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
ログに本文全文、メールアドレス平文、IP平文を出さない。メールアドレスは必要時のみDBに保存し、ログではhashまたは末尾マスクとする。

## 9. Codex実装指示
まずはNestJS Loggerラッパーを作成し、`AuditLogService` と `MetricsService` を分離する。監視SaaS未導入でも動くよう、DB保存とコンソールログを初期実装とする。
