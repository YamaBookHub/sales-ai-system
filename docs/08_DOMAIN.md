# 08_DOMAIN.md

## ドメイン実装仕様

## 1. 結論
中核ドメインはCompany、Project、Lead、Mail、AI、Taskである。状態遷移と不変条件をServiceで強制する。

## 2. 集約
| Aggregate | Root | 子 |
|---|---|---|
| Company | Company | ContactPerson, SalesLead |
| Lead | SalesLead | LeadScore, OutreachEmail, Task |
| Mail | OutreachEmail | EmailEvent, EmailReply, TrackedLink, MailAttachment |
| AI | AiGeneration | なし |

## 3. Lead状態
`discovered -> qualified -> drafted -> reviewing -> approved -> queued -> contacted -> replied -> meeting_candidate` を基本とする。対象外はarchived。

## 4. Mail状態
`draft -> in_review -> approved -> queued -> sending -> sent`。失敗はfailed、取り消しはcancelled。

## 5. LeadScore
amountScore、supporterScore、urgencyScore、fitScore、activityScore、totalScoreで構成。75以上high、50以上medium、それ未満lowを初期目安にする。

## 6. 不変条件
配信停止・NG企業・承認前・送信済み再送は禁止。AI出力は上書きせずAiGenerationに追記する。


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
