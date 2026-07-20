# セキュリティ・安全仕様

## 1. 現在の位置づけ

この文書は現行コードの安全境界を記載する。認証と単一組織内のrole別RBAC・重要操作監査は実装済みである。組織分離はLA-007で行うため、これだけで複数顧客向け外部公開可能とは扱わない。

## 2. 実装済みの安全境界

### メール生成・承認・送信

- AI生成メールは `draft` 保存までで、自動送信しない。
- `in_review` または `approved` のメールだけを棄却できる。
- 承認は送信前checklistが全項目checkedの場合だけ可能である。
- `approved` 以外のメールは `queued` にできない。
- `queued` への遷移にもchecklist完了を要求する。
- 実送信は `queued` かつchecklist完了の場合だけ開始する。
- `queued` から `sending` へのclaimは条件付き更新で行い、同じメールの二重claimを防ぐ。
- `sending` で停止したメールは自動再送しない。provider確認後の手動 `mark-sent` で復旧する。
- 送信状態の遷移、claim、追跡イベントは `EmailEvent` に記録する。

### Providerと環境設定

- `MAIL_SEND_ENABLED=true` を明示しない限りsenderはdisabledで、実送信しない。
- `MAIL_SENDER_PROVIDER=gmail` のときだけGmail sender候補になり、`GMAIL_CLIENT_ID`、`GMAIL_CLIENT_SECRET`、`GMAIL_REFRESH_TOKEN`、`GMAIL_FROM_EMAIL` が揃わなければdisabledになる。
- Gmail senderは `email` channelだけを受け付け、`site_message` と `contact_form` は拒否する。
- Gmail OAuthは送信用refresh tokenを使うprovider境界であり、アプリ利用者のログインOAuthではない。
- 送信前に宛先の存在とproviderの対応可否を検証する。

### AI出力

- OpenAI応答はJSON形式を検証し、案件との整合性を確認してから保存する。
- OpenAI呼び出しに失敗した場合、既存メールやlead状態を更新しない。
- OpenAI API keyや送信認証情報を画面やレスポンスへ返さない。

### 配信停止・block

- `ContactPerson.isUnsubscribed`、`unsubscribedAt` を更新する配信停止APIがある。
- `Company.isBlocked` を更新するblock APIがある。
- 返信一覧では配信停止・block・拒否返信を停止判断として表示・フィルタする。
- 下書き、レビュー、承認、queue、手動送信記録、実送信claimで、会社blockとcontact配信停止を共通検査する。
- メール、問い合わせURL、サイト内送信URLを正規化した送信先キーで比較し、作業中または送信済みの別メールがある場合は重複接触を拒否する。
- 判定と状態更新は送信先単位のadvisory lockを含む同一transactionで行う。

## 3. 認証・権限の実装状況

認証方式、画面/APIの保護範囲、Googleログイン、local開発、session、CSRFは `37_AUTHENTICATION_CONTRACT.md` に従って実装済みである。

### DBに定義済み

`UserRole` enumは `admin`、`manager`、`operator`、`viewer` を持ち、`User.role`、`User.isActive`、`AuditLog.userId` を保存できる。

### 実装済み

- opaque session Cookieによるログイン/logoutとcurrent user確定
- Google OAuth/OIDC Authorization Code + PKCEと事前登録active user限定
- loopback専用の固定local user login
- default denyのauthentication guard、inactive user拒否、Origin/CSRF検証
- `X-Operator-Email` と利用者の自動作成・再有効化の廃止
- import、分析、メールworkflow、商談、配信停止等への認証済みactor伝播
- `admin` / `manager` / `operator` / `viewer` によるpermission enforcement
- 全保護operationのfail-closed metadataと403
- 重要操作のactor/session付きAuditLogとadmin監査一覧
- `/api/auth/me` のrole別permissions
- 最後のadmin保護、self-lockout防止、role/active変更時のsession失効

### 未実装

- 組織ごとのデータ分離

したがって、role enumと認証の存在だけで「RBAC・複数組織対応済み」と書かない。

現行 `POST /api/unsubscribe` は認証・CSRF必須であり、社内の手動配信停止にだけ使用する。受信者向け公開配信停止は、対象と期限を署名したtokenを必要とする別routeを設計するまで公開しない。

## 4. 監査と個人情報

- `AuditLog` modelと、project import・seedなど一部操作の記録は実装済み。
- import、分析、生成、編集、review、承認、queue、send記録、unsubscribe、商談操作、user/role変更のactor伝播または監査はLA-004で実装済み。AuditLogは業務履歴と別に正本として保持する。
- `EmailEvent` はメールworkflowと追跡イベントの履歴に使う。これだけで全操作の監査を満たすとは扱わない。
- IPはschema上 `ipHash` で保存できる。平文IPの保存、保管期間、User-Agent、メール本文とAI入力の扱いは運用・法務確認が必要である。
- AIは実績、数値、制度、日付、社名、成果保証を創作しない。未知の情報は未知として扱う。

## 5. 未実装・将来要件

- 組織別RBACとデータ分離（LA-007）
- job所有者と複数instance間の停止権限（LA-005）
- worker、Redis、scheduler、DLQ、rate limit、外部providerの真の冪等性
- 重要操作の完全なAuditLog、監視、運用上のsecret rotation、本番hardening

本番で実送信を有効化する場合は、少なくとも認証・RBAC、完全な操作監査、rate limit、provider障害時の運用手順を別途完了させる。
