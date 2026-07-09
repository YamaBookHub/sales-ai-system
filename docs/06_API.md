# 06_API.md

## API実装仕様

## 1. 結論
NestJS REST APIで実装する。状態遷移、承認、送信可否、AI実行はService層に集約する。詳細は `openapi/openapi.yaml` と整合させる。

## 2. 共通仕様
Responseは `{ data, meta, error }`。Paginationは `page`, `limit`, `sort`。エラーは400/401/403/404/409/429/500を使う。

MVPではローカル営業画面をNestJS API内に同梱し、`GET /` でHTMLを返す。API本体は `/api/*` を使う。

## 3. Lead API
| Method | Path | 用途 |
|---|---|---|
| GET | /api/leads | 一覧 |
| POST | /api/leads | 作成 |
| GET | /api/leads/{id} | 詳細 |
| PATCH | /api/leads/{id} | 更新 |
| POST | /api/leads/{id}/score | 再スコア |

`GET /api/leads` は営業リスト画面で使うため、各Leadに `company`、`project`、最新 `scores` を含める。
`PATCH /api/leads/{id}` は営業管理用に、連絡先、送信記録、ブランド/SNS分析メモ、次回確認日を保存できる。

## 4. Company / Project API
| Method | Path | 用途 |
|---|---|---|
| GET/POST | /api/companies | 企業一覧/作成 |
| POST | /api/companies/{id}/block | NG設定 |
| GET/POST | /api/projects | 案件一覧/作成 |
| GET | /api/projects/categories/campfire | CAMPFIREカテゴリ候補を取得 |
| POST | /api/projects/search/campfire | CAMPFIREから取り込み候補URLを検索 |
| POST | /api/projects/import/campfire | CAMPFIRE URLからCompany/Project/Leadを作成 |

`GET /api/projects/categories/campfire` はCAMPFIREの検索ページからカテゴリ候補を取得し、基本カテゴリ候補と統合して画面の検索プルダウンに使う。カテゴリは表示名と検索用valueを返す。
`POST /api/projects/search/campfire` は営業リストを絞り込むAPIではなく、営業リストへ取り込む前のCAMPFIRE候補URL検索に使う。キーワード、検索用カテゴリvalue、現在公開中、終了間近、支援額レンジ、サポーター数レンジ、過去プロジェクト数レンジから変換した下限/上限、最大表示件数を受け取り、候補のタイトル、URL、支援額、サポーター数、残り日数、過去プロジェクト数を返す。最大表示件数は10件、50件、100件から選ぶ。過去プロジェクト数レンジが指定された場合は候補ページを追加確認するため、通常検索より時間がかかる場合がある。
過去プロジェクト数レンジが指定された場合は、先に最大表示件数で切らず、最大100件の候補を確認してから過去プロジェクト数で絞り込み、最後に最大表示件数まで返す。
`POST /api/projects/import/campfire` はCAMPFIREページ内の外部リンクから、公式サイト、問い合わせフォーム、Instagram、TikTok、Xを可能な範囲で抽出する。抽出結果はCompanyとSalesLeadの空欄に保存し、手入力済みの値は上書きしない。
過去プロジェクト数は、実行者プロフィールページの「初めてのプロジェクトです」または「他にN件のプロジェクトを掲載しています」という表示を優先して取得する。
過去プロジェクト数で初回のみを指定した場合は、プロフィールページを確認でき、過去プロジェクト数が0件と判断できた候補だけを返す。プロフィール取得に失敗した候補は初回扱いしない。
過去プロジェクトが100件以上ある可能性がある実行者は、過去案件の詳細スクレイピングを行わず、SalesLeadのブランド分析メモに注意文を保存する。

## 5. Mail API
| Method | Path | 用途 |
|---|---|---|
| GET | /api/mails | 一覧 |
| POST | /api/mails/draft | 下書き作成 |
| POST | /api/mails/{id}/request-review | レビュー依頼 |
| POST | /api/mails/{id}/request-rereview | 再レビュー依頼 |
| POST | /api/mails/{id}/approve | 承認 |
| POST | /api/mails/{id}/reject | 棄却 |
| POST | /api/mails/{id}/queue | キュー投入 |
| POST | /api/mails/{id}/retry | 再試行 |
| POST | /api/mails/{id}/cancel | キャンセル |

`GET /api/mails` はメール確認画面で使うため、各Mailに `company` と `lead.project` を含める。
`PATCH /api/mails/{id}` は件名と本文の編集保存に使う。
`GET /api/mails/{id}/checklist` は送信前チェックリストを取得する。
`PATCH /api/mails/{id}/checklist` は送信前チェックリストを保存する。
`POST /api/mails/{id}/approve` と `POST /api/mails/{id}/queue` は、送信前チェックが未完了の場合409で止める。
`POST /api/mails/{id}/reject` は `in_review`、`approved` のメールを `rejected` にする。棄却理由は保存する。
`POST /api/mails/{id}/request-rereview` は `rejected` のメールを `in_review` に戻し、棄却理由をクリアする。本文修正後の再確認に使う。

## 6. AI API
| Method | Path | 用途 |
|---|---|---|
| POST | /api/ai/leads/{id}/email-draft | メール下書き生成 |
| GET | /api/ai/leads/{id}/generations | Lead別AI生成履歴 |
| POST | /api/ai/replies/{id}/classify | 返信分類 |
| POST | /api/ai/leads/{id}/next-action | 次アクション提案 |

`GET /api/ai/leads/{id}/generations` は営業画面のAI分析結果パネルで使う。最新20件の `AiGeneration` と紐づくメール概要を返す。

## 7. Tracking API
| Method | Path | 用途 |
|---|---|---|
| GET | /t/open/{emailId}.png | 開封計測 |
| GET | /t/click/{token} | クリック計測 |
| POST | /api/unsubscribe | 配信停止 |

## 8. DTO制約
CreateLeadDtoはcompanyId必須。UpdateLeadDtoはstatus、priority、ownerMemo、連絡先、送信記録、ブランド/SNS分析メモを任意更新できる。CreateMailDraftDtoはleadId、templateKey必須。UpdateMailDtoはsubject/bodyを任意更新できる。Approveは将来manager以上に制限する。

## 9. 完了条件
OpenAPIと主要Pathが一致し、承認なし送信不可・配信停止送信不可が409で返る。


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
