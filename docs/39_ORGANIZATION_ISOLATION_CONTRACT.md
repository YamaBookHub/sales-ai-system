# 組織データ分離契約

## 1. 目的

LA-007では、複数顧客が同じアプリとDBを利用しても、他組織の営業情報を閲覧・更新できない状態を作る。API入力の`organizationId`は信用せず、認証済みsessionに固定された組織を唯一の処理範囲とする。

## 2. 正本

- `User`: 全組織共通の本人識別子。email、Google subject、全体利用停止だけを保持する。
- `Organization`: 契約組織。slug、名称、有効状態を保持する。
- `OrganizationMembership`: 組織とUserの所属、組織内表示名、role、有効状態を保持する。
- `UserSession.organizationId`: そのsessionで操作できる組織を固定する。
- `OrganizationMembership.role`: RBACの唯一のrole正本とし、`User.role`は移行時に廃止する。

`AuthenticatedPrincipal`は`userId`、`sessionId`、`organizationId`、membership由来の`role`を持つ。header、query、bodyからroleやorganizationIdを受け取らない。

## 3. 組織を持つデータ

`CrowdfundingPlatform`は全組織共通の取得元カタログとし、`User`とともにorganization scopeの対象外とする。それ以外の業務データは`organizationId`を直接持つ。

- Company、ContactPerson、CrowdfundingProject、SalesLead、LeadScore
- OutreachEmail、MailTemplate、MailChecklistItem、EmailEvent、EmailReply
- TrackedLink、LinkClick、MailAttachment
- AiGeneration、AiUsageLedger、LeadAnalysisRevision
- Task、Opportunity、OpportunityStageHistory、AuditLog
- メモリ内のProjectSearchJob

一覧、詳細、更新、削除、集計、exportは常に`organizationId`を条件に含める。別組織のIDを指定された場合は存在を漏らさず404として扱う。

## 4. DBの防御

親子関係は`organizationId + id`の複合外部キーで結び、別組織の親IDを保存できないようにする。親側には`@@unique([organizationId, id])`を置く。

組織単位へ変更する一意制約:

- CrowdfundingProject: `organizationId + url`
- MailTemplate: `organizationId + key`
- SalesLead: `organizationId + companyId + projectId`
- LeadAnalysisRevision: `organizationId + leadId + version`
- Opportunity: `organizationId + leadId`
- OpportunityStageHistory: `organizationId + operationKey`
- Gmail message ID、送信先重複判定など、顧客間で共有してはならない業務キー

全体一意を維持する値:

- User email、Google subject
- Organization slug
- session token
- 公開追跡token
- CrowdfundingPlatformの識別情報

advisory lockのキーには必ずorganizationIdを含める。現在のPrisma接続方式ではrequest単位の`SET LOCAL`を全queryへ保証できないため、LA-007ではRLSを導入しない。読み取りは明示的repository scope、越境書き込みは複合外部キーで守る。

## 5. 認証と組織内ユーザー管理

- session取得時にUser、Organization、OrganizationMembershipの有効性を毎回確認する。
- `UserSession(organizationId, userId)`は`OrganizationMembership(organizationId, userId)`への複合外部キーを持つ。
- local/test loginは対象組織を明示し、所属の先頭を暗黙選択しない。
- Google loginで複数所属がある場合は対象組織を明示する。指定組織への所属を検証してからsessionを発行する。
- 組織切替では旧sessionを失効し、新しいsession tokenとCSRF tokenを発行する。
- `/api/admin/users`は現在組織のmembershipを管理する。組織管理者はUser全体を停止しない。
- 最後のadmin保護は組織単位とする。
- Task担当者、商談担当者、メール承認者は同じ組織の有効membershipに限定する。

## 6. 特殊な入口

### 公開追跡

公開URLはorganizationIdを入力として受け取らない。推測不能tokenから親メールと組織を内部解決し、クリック、開封、配信停止、Lead更新を同じ組織内で実行する。

### 検索job

LA-007ではメモリ内jobにorganizationIdとownerUserIdを保存する。開始、進捗取得、停止、取得済みURL判定を組織で分離する。永続化、再起動復元、複数instance対応はLA-005で扱う。

### 集計とexport

CSV/TSV、営業成績、今日の対応、返信一覧、ナビゲーション件数、AI予算、監査一覧はactive organizationを必須条件にする。API利用者が任意のorganizationIdを指定する機能は追加しない。

## 7. 既存データ移行

既定組織IDは`00000000-0000-4000-8000-000000000007`、slugは`default`とする。

1. OrganizationとOrganizationMembershipを作る。
2. 既存Userのroleを既定組織membershipへコピーする。
3. 全業務テーブルへnullableなorganizationIdを追加する。
4. 既存行を既定組織へbackfillする。
5. 親子relationと件数が維持されていることを検査する。
6. 既存sessionを全失効する。
7. organizationIdをNOT NULLにし、複合外部キーと組織別uniqueを有効にする。
8. User.roleと旧global uniqueを削除する。
9. organizationIdの移行用defaultは残さない。

2組織目の書き込み後は単一組織版へrollbackしない。問題時は書き込みを止め、組織対応版をroll forwardする。

## 8. 必須テスト

- 2組織へ同じ案件URL、テンプレートkey、operationKeyを登録できる。
- 同一組織内の重複は拒否される。
- 他組織IDによるread、write、deleteは失敗し、存在を漏らさない。
- DBへ別組織の親子relationを直接保存すると外部キー違反になる。
- 一覧、件数、CSV/TSV、営業成績、AI費用、監査へ他組織データが混ざらない。
- 検索jobの参照、停止、取得済みURLが組織分離される。
- 公開tokenが対応する組織だけを更新する。
- membership停止、Organization停止、role変更後のsessionは拒否される。
- 最後のadminを同時更新しても組織内に1人残る。
- 同一組織の並列取り込みは1件、別組織の並列取り込みは各1件になる。
- migration後に既存全モデルの件数とrelationが維持される。

LA-007は実PostgreSQLで越境拒否を確認するまでcompleteにしない。
