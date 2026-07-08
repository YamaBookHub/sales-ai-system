# 01_REQUIREMENTS.md

## 営業AIシステム 要件定義

## 1. 結論
MVP要件は、営業候補を安全に管理し、AIで下書きを作り、人間承認後に送信し、返信・反応を次アクションにつなげることである。

## 2. ユーザー種別
| Role | 権限 |
|---|---|
| admin | 全権限、設定、ユーザー管理 |
| manager | メール承認、KPI確認、送信停止判断 |
| operator | 候補登録、AI下書き、レビュー依頼 |
| viewer | 閲覧のみ |

## 3. 機能要件
| 領域 | 要件 |
|---|---|
| Company | 会社名、HP、問い合わせURL、担当者、NG管理 |
| Project | プラットフォーム、URL、支援額、サポーター数、終了日 |
| Lead | ステータス、優先度、スコア、次アクション |
| Mail | draft/in_review/approved/queued/sent/failedを管理 |
| AI | 下書き、件名、返信分類、スコア補助 |
| Tracking | 開封、クリック、配信停止 |
| Task | 返信後・未対応のタスク管理 |

## 4. 非機能要件
- 重要操作は監査ログに保存する。
- 外部APIはAdapter化する。
- 送信処理はQueue化する。
- AI出力はJSON schemaで検証する。
- 本番初期は `MAIL_SEND_ENABLED=false` とする。

## 5. 受入条件
1. Leadを作成できる。 2. AI下書きを作成できる。 3. 承認済みのみ送信キューへ入る。 4. 送信結果がDBへ保存される。 5. 返信分類とTask作成ができる。


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
