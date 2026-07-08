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

## 6. MVP Phase 1受入条件

Phase 1では送信自動化より前に、営業候補管理とメール下書き確認を優先する。

1. CAMPFIRE URLを手入力してCompany / Project / Leadを作成できる。
2. ローカル営業画面 `/` でLead一覧を確認できる。
3. 選択LeadからOpenAI APIで営業メール下書きを生成できる。
4. 生成メールを `draft` として保存できる。
5. 件名と本文を画面で編集保存できる。
6. `draft -> in_review -> approved -> queued` の状態遷移を操作できる。
7. 未承認メールは `queued` にできない。
8. 送信前チェックリストを画面で確認できる。

## 7. 未実装範囲

- Makuake / GREEN FUNDINGの自動取り込み
- 開催中案件の自動探索
- 会社HP / SNS分析
- 問い合わせフォーム、メールアドレス、サイト内連絡先の自動探索
- 参考メールRAG
- 送信後の返信同期と分類
- 面談、提案、見積、受注後対応


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
