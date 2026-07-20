# RBAC・監査契約

## 1. 適用範囲

この文書は、LA-004で完成させる単一組織内の権限管理と操作監査の正本である。

- 認証済み利用者の最終的な操作可否はサーバー側で判定する。
- 画面でボタンを隠しても権限判定の代わりにはしない。
- すべての保護operationは明示的なpermission metadataを持つ。metadataがない保護operationはfail closedで拒否する。
- `GET /api/auth/me` はcurrent userの `permissions` 配列を返す。UIはこの配列を表示制御に使ってよい。
- LA-007完了までは単一組織専用であり、複数顧客向けの外部公開・販売を許可しない。

## 2. Roleとpermission

permissionはAPIの操作能力を表し、roleの継承順やenumの数値比較では判定しない。

| Permission | viewer | operator | manager | admin |
|---|:---:|:---:|:---:|:---:|
| `workspace.read` | ○ | ○ | ○ | ○ |
| `reports.read` | ○ | ○ | ○ | ○ |
| `ai.cost.read` | - | - | ○ | ○ |
| `prospecting.execute` | - | ○ | ○ | ○ |
| `records.write` | - | ○ | ○ | ○ |
| `analysis.execute` | - | ○ | ○ | ○ |
| `compliance.manage` | - | - | ○ | ○ |
| `mail.review` | - | - | ○ | ○ |
| `mail.queue` | - | - | ○ | ○ |
| `mail.send` | - | - | - | ○ |
| `template.manage` | - | - | ○ | ○ |
| `opportunity.write` | - | ○ | ○ | ○ |
| `opportunity.reopen` | - | - | ○ | ○ |
| `user.manage` | - | - | - | ○ |
| `audit.read` | - | - | - | ○ |

Roleの意味は次のとおりとする。

- `viewer`: 画面・レポートの閲覧のみ。
- `operator`: 候補取得、営業データ更新、分析、メール下書き、通常の商談操作を行う。
- `manager`: operatorの操作に加え、配信停止・block、レビュー、承認、棄却、queue、定型文管理、商談再開を行う。
- `admin`: managerの操作に加え、実送信、利用者管理、監査ログ閲覧を行う。

operatorの商談操作には、担当案件または未担当案件のみという既存のowner policyを適用する。manager/adminは全件を扱える。受注済み案件の通常再開は許可しない。

## 3. API割当

OpenAPIの各保護operationには、実装の `@RequirePermissions` と同じ `x-permission` を付ける。

| 業務領域 | permission | 対象操作 |
|---|---|---|
| 画面・通常閲覧 | `workspace.read` | HTML画面、navigation、会社・案件・lead・メール・task・返信・履歴のGET |
| レポート | `reports.read` | 営業成績と担当者候補 |
| AI費用 | `ai.cost.read` | AI利用量・概算費用 |
| 候補取得 | `prospecting.execute` | 検索、検索job停止、単体/一括取り込み、手動project作成 |
| 営業データ更新 | `records.write` | 会社・連絡先・lead・task・メール下書き/編集、返信、手動送信記録 |
| AI操作 | `analysis.execute` | 分析、分析確認、メール生成、整形、意味整合性、返信分類 |
| 配信停止・block | `compliance.manage` | 会社block、連絡先unsubscribe、社内配信停止 |
| メールレビュー | `mail.review` | approve、reject |
| メールqueue | `mail.queue` | queue、retry、cancel |
| 実送信 | `mail.send` | `POST /api/mails/{id}/send` |
| 定型文 | `template.manage` | 定型文保存、一括取り込み |
| 商談 | `opportunity.write` / `opportunity.reopen` | 通常更新/遷移、終端案件の再開 |
| 利用者 | `user.manage` | `/api/admin/users`、role/active変更、session失効 |
| 監査 | `audit.read` | `/api/admin/audit-logs` |

実送信はadminだけに許可する。operatorはapprove/queueできず、managerはapprove/queueできるが実送信できない。`approved` 以外をqueueできない、checklist未完了を承認・queueできない、というメール業務ルールも別途維持する。

## 4. 管理API

| Method | Path | permission | 用途 |
|---|---|---|---|
| GET | `/api/admin/users` | `user.manage` | 利用者一覧、role/active filter |
| POST | `/api/admin/users` | `user.manage` | 事前登録利用者の作成 |
| PATCH | `/api/admin/users/{id}` | `user.manage` | name、role、active状態の変更 |
| POST | `/api/admin/users/{id}/revoke-sessions` | `user.manage` | 対象利用者の全session失効 |
| GET | `/api/admin/audit-logs` | `audit.read` | 監査ログの検索・ページング |

メールアドレスは作成後に変更しない。変更が必要な場合は新しいUserを作成し、旧Userを停止する。role変更・利用停止時は対象Userのactive sessionを失効させる。

## 5. AuditLog契約

### 5.1 記録単位

成功した重要操作は業務状態の更新と同じtransaction内でAuditLogを作成する。監査行には次を保存する。

- `userId`: 認証済みactor。匿名の業務更新には使わない。
- `sessionId`: 使用したsession。nullableで、過去のmigration/seed行はnullを許容する。
- `action`: 安定したドット区切りのaction名。
- `entityType` / `entityId`: 操作対象。
- `before` / `after`: 業務判断に必要な安全な差分。
- `createdAt`、必要な場合だけ `ipHash` と `userAgent`。

必須actionの例は次のとおり。

`project.imported`、`project.created`、`lead.created`、`lead.updated`、`lead.scored`、`analysis.generated`、`analysis.edited`、`analysis.confirmed`、`mail.created`、`mail.updated`、`mail.review_requested`、`mail.rereview_requested`、`mail.rejected`、`mail.approved`、`mail.queued`、`mail.send_started`、`mail.sent`、`mail.send_failed`、`mail.marked_sent`、`contact.unsubscribed`、`company.blocked`、`opportunity.transitioned`、`opportunity.reopened`、`user.created`、`user.role_changed`、`user.deactivated`、`user.reactivated`、`user.sessions_revoked`。

### 5.2 保存禁止情報

- メール本文、AI入力、prompt、token、API key、OAuth secretは保存しない。
- メール編集は本文そのものではなく、変更フィールド名とcontent hashなどの検証用情報だけを保存する。
- 平文IPは保存せず、必要な場合は既存の `ipHash` を使う。
- `before` / `after` は社名や状態などの最小限の安全なsnapshotに限定する。

権限拒否は `authorization.denied` として、actor、session、要求permission、routeを本文やsecretなしで記録してよい。拒否された操作は業務データを変更しない。

## 6. 最後のadminとself-lockout

- admin自身の降格・停止は拒否する。
- 最後の有効なadminの降格・停止は拒否する。
- role変更・停止・session失効とその監査は同じtransactionで行う。
- 利用者削除ではなくactive=falseを基本とし、監査履歴のactor参照を壊さない。
- session失効後のrequestは再認証を要求し、失効処理自体は監査に残す。

## 7. LA-004と後続作業の境界

### LA-004で完了させる範囲

- 単一組織内の4 roleと15 permission。
- 全保護operationのfail-closed metadata。
- メール承認、queue、実送信の権限制限。
- 利用者管理、最後のadmin/self-lockout防止、session失効。
- 重要操作のactor付きAuditLogとadmin監査一覧。
- `/api/auth/me` のpermissions配列、OpenAPIの403契約。

### LA-005へ残す範囲

検索jobの所有者、jobの共有store、restart後の状態復元、複数instance間の停止権限、TTLとcancelの永続化はLA-005で扱う。LA-004では検索jobのowner isolationを仮実装しない。

### LA-007へ残す範囲

Organization、Membership、organization scope、組織単位のunique/index、既存データ移行、全read/write/export/jobの越境拒否はLA-007で扱う。LA-004のUserRoleは単一組織のroleとして扱い、組織IDを推測で追加しない。

## 8. Rollbackと公開条件

- DB変更はsessionIdと監査検索用indexの追加のみとし、既存監査行を削除するdown migrationは行わない。
- 問題発生時はアプリを旧revisionへ戻し、追加列・indexは残してよい。
- 復旧中は外部公開と実送信を停止し、`MAIL_SEND_ENABLED` を有効化しない。
- LA-004完了だけでは複数顧客向けproduction公開を許可しない。LA-007の組織分離、LA-005のjob所有者、LA-006の復元確認など、公開前タスクの完了を別途要求する。
