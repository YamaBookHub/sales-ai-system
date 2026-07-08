# 06_API.md

## API実装仕様

## 1. 結論
NestJS REST APIで実装する。状態遷移、承認、送信可否、AI実行はService層に集約する。詳細は `openapi/openapi.yaml` と整合させる。

## 2. 共通仕様
Responseは `{ data, meta, error }`。Paginationは `page`, `limit`, `sort`。エラーは400/401/403/404/409/429/500を使う。

## 3. Lead API
| Method | Path | 用途 |
|---|---|---|
| GET | /api/leads | 一覧 |
| POST | /api/leads | 作成 |
| GET | /api/leads/{id} | 詳細 |
| PATCH | /api/leads/{id} | 更新 |
| POST | /api/leads/{id}/score | 再スコア |

## 4. Company / Project API
| Method | Path | 用途 |
|---|---|---|
| GET/POST | /api/companies | 企業一覧/作成 |
| POST | /api/companies/{id}/block | NG設定 |
| GET/POST | /api/projects | 案件一覧/作成 |
| POST | /api/projects/import/campfire | CAMPFIRE URLからCompany/Project/Leadを作成 |

## 5. Mail API
| Method | Path | 用途 |
|---|---|---|
| GET | /api/mails | 一覧 |
| POST | /api/mails/draft | 下書き作成 |
| POST | /api/mails/{id}/request-review | レビュー依頼 |
| POST | /api/mails/{id}/approve | 承認 |
| POST | /api/mails/{id}/queue | キュー投入 |
| POST | /api/mails/{id}/retry | 再試行 |
| POST | /api/mails/{id}/cancel | キャンセル |

## 6. AI API
| Method | Path | 用途 |
|---|---|---|
| POST | /api/ai/leads/{id}/email-draft | メール下書き生成 |
| POST | /api/ai/replies/{id}/classify | 返信分類 |
| POST | /api/ai/leads/{id}/next-action | 次アクション提案 |

## 7. Tracking API
| Method | Path | 用途 |
|---|---|---|
| GET | /t/open/{emailId}.png | 開封計測 |
| GET | /t/click/{token} | クリック計測 |
| POST | /api/unsubscribe | 配信停止 |

## 8. DTO制約
CreateLeadDtoはcompanyId必須。CreateMailDraftDtoはcompanyId、subject、body必須。Approveはmanager以上のみ。

## 9. 完了条件
OpenAPIと主要Pathが一致し、承認なし送信不可・配信停止送信不可が409で返る。


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
