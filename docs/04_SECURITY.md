# セキュリティ・安全仕様

## 1. 現在の位置づけ

この文書は現行コードの安全境界を記載する。DBに将来用のroleやblockフラグがあることだけを理由に、認証・RBAC・送信制御が実装済みとは扱わない。

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
- ただし現行の `send-queued` 共通guardはstatus、checklist、sender設定を検査するもので、会社blockとcontact配信停止をclaim前に拒否する処理は未実装である。実送信を有効化する前に補完が必要である。

## 3. 認証・権限の実装状況

### DBに定義済み

`UserRole` enumは `admin`、`manager`、`operator`、`viewer` を持ち、`User.role`、`User.isActive`、`AuditLog.userId` を保存できる。

### 未実装

- ログイン、logout、session/JWT、GoogleユーザーOAuth、current userの確定
- authentication guard、routeごとの認可guard、inactive userの拒否
- `admin` / `manager` / `operator` / `viewer` によるRBAC enforcement
- actorを認証済みuserから取得する監査境界

したがって、role enumの存在だけで「RBAC実装済み」と書かない。現行APIには内部操作を識別するためのheaderを受け取るrouteがあるが、これは認証の代替ではない。

## 4. 監査と個人情報

- `AuditLog` modelと、project import・seedなど一部操作の記録は実装済み。
- すべてのimport、分析、生成、編集、review、承認、queue、send、unsubscribe、user/role変更を認証userに紐づけて監査する仕組みは未実装。
- `EmailEvent` はメールworkflowと追跡イベントの履歴に使う。これだけで全操作の監査を満たすとは扱わない。
- IPはschema上 `ipHash` で保存できる。平文IPの保存、保管期間、User-Agent、メール本文とAI入力の扱いは運用・法務確認が必要である。
- AIは実績、数値、制度、日付、社名、成果保証を創作しない。未知の情報は未知として扱う。

## 5. 未実装・将来要件

- JWT/sessionまたはGoogleユーザーOAuthによる認証
- RBACとcurrent userを利用した全API保護
- block・配信停止を含む送信前共通guard
- worker、Redis、scheduler、DLQ、rate limit、外部providerの真の冪等性
- 重要操作の完全なAuditLog、監視、secret rotation、CSRF/CORS等の本番hardening

本番で実送信を有効化する場合は、少なくとも認証・RBAC、送信前共通guard、監査、rate limit、provider障害時の運用手順を別途完了させる。
