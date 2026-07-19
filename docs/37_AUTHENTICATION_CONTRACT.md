# 37_AUTHENTICATION_CONTRACT

## 1. 目的と適用範囲

この文書は LA-002 の認証契約であり、LA-003 の実装判断を固定する。

対象は次のとおり。

- local / test / staging / production のログイン方法
- 利用者を確定するサーバー管理session
- Google OAuth/OIDCによる本人確認
- current user、logout、inactive user拒否
- 画面・APIの保護範囲
- `X-Operator-Email` 廃止順
- 初期admin作成とsecret管理

このタスクではコード、DB、環境変数、OpenAPIを変更しない。単一組織内のRBACと全操作の監査はLA-004、組織ごとのデータ分離は独立したLA-007で実装する。

## 2. 現状と解消する問題

現行はログイン・session・JWT・利用者Google OAuthがなく、画面と業務APIを誰でも呼べる。

案件取り込みの3操作だけは、ブラウザの `localStorage` にあるメールアドレスを `X-Operator-Email` で送り、サーバーがその値から `User` を自動作成または再有効化している。これは本人確認ではなく、任意の利用者を名乗れるため認証として扱わない。

また、商談操作は固定の `manager` と `userId: null`、メール承認は承認者未記録であり、`User` と `AuditLog` が存在してもcurrent userは確定していない。

## 3. 採用方式

### 3.1 サーバー管理のopaque session

ブラウザ認証には、推測不能なランダムtokenをCookieで渡すサーバー管理sessionを採用する。JWTをブラウザの認証には使わない。

理由:

- 現行はNestJSと画面が同一オリジンであり、外部公開API用tokenが不要
- logout、利用停止、権限変更を直ちに反映できる
- tokenをブラウザ保存領域へ置かず、失効状態をDBで管理できる
- 将来の複数instanceでもDBを正本にできる

将来、外部APIを提供する場合は、このsessionとは別に短命なaccess token契約を設計する。LA-003でJWT互換を追加しない。

### 3.2 sessionデータ

LA-003では `UserSession` 相当のmodelを追加する。

| 項目 | 契約 |
|---|---|
| session ID | UUID。監査・失効の識別子 |
| user ID | 既存 `User.id` への外部キー |
| token hash | 256-bit以上のランダムtokenをhash化して保存。平文tokenは保存しない |
| CSRF token hash | mutation検証用tokenのhash |
| absolute expiry | ログインから24時間 |
| idle expiry | 最終利用から8時間 |
| last seen | 更新頻度を5分に制限し、毎requestのDB writeを避ける |
| revoked at | logout・利用停止・管理者失効の時刻 |
| IP hash | 任意。保存する場合はsecret付きHMAC。平文IPを保存しない |
| user-agent hash | 任意。平文全文をsessionへ保存しない |

token hashと有効期限にはindexを置く。期限切れsessionは定期削除またはログイン時・参照時の小分け削除対象とする。

### 3.3 Cookie

- staging / productionの名前: `__Host-sales_ai_session`
- localの名前: `sales_ai_session`
- `HttpOnly=true`
- `SameSite=Lax`
- `Path=/`
- staging / production: `Secure=true`
- localのHTTPだけ: `Secure=false`
- JavaScriptからsession tokenを読ませない
- ログイン成功時に新しいsessionを発行し、既存tokenを再利用しない
- Cookieの `Max-Age` はDBのabsolute expiryを超えない。idle利用で `lastSeenAt` を更新してもabsolute expiryとCookieの最大期限は延長しない

Cookie設定は `APP_ENV` から決める。requestの任意headerでSecure設定を切り替えない。

## 4. Googleログイン

### 4.1 用途

Google OAuth 2.0 / OpenID ConnectのAuthorization Code flowとPKCEを利用し、`openid email profile` だけを要求する。

検証必須項目:

- `state`、`nonce`、PKCE verifier
- issuer、client IDを表すaudience、署名、有効期限
- `email_verified=true`
- callback URL完全一致

OAuth flow用のstate/nonce/PKCEは、短命で署名されたHttpOnly Cookieまたは一時DB recordに保存する。callback完了後は必ず破棄する。

### 4.2 Userとの対応

- Googleのemailをtrim・小文字化して既存 `User.email` と照合する
- `User` が存在し、`isActive=true` かつ `deletedAt=null` の場合だけログインを許可する
- 初回の許可済みログインでGoogleの安定したsubjectを `User.googleSubject` 相当のunique列へ紐付け、2回目以降はsubject一致も必須にする
- 未登録emailから `User` を自動作成しない
- inactive、削除済み、未登録の利用者には同じ一般的な拒否表示を返し、登録有無を外部へ詳しく示さない
- Google access token / refresh tokenは保存しない

Gmail実送信用の `GMAIL_*` credentialはシステム送信者用であり、利用者ログインcredentialと共用しない。

## 5. 環境別契約

| 環境 | 認証方式 | 条件 |
|---|---|---|
| test | test専用session helper | `NODE_ENV=test` のときだけ使用。任意headerを本人確認に使わない |
| local | 設定で固定した既存active userのlocal login | `APP_ENV=local`、`AUTH_MODE=local`、loopback listenの全条件を満たす場合だけ有効 |
| staging | Google OAuth/OIDC | HTTPS、Secure Cookie、事前登録User、staging専用client/secret |
| production | Google OAuth/OIDC | HTTPS、Secure Cookie、事前登録User、production専用client/secret |

local loginはemailとパスワードの代用品ではなく、開発専用の入口である。`AUTH_DEV_USER_EMAIL` で固定したactiveな既存Userだけを利用し、request bodyや画面入力で利用者を切り替えない。User作成・再有効化は行わない。role別の自動testはtest専用session helperを使う。staging / productionでlocal login設定が有効ならアプリ起動を拒否する。

LA-003で予定する設定名:

- `APP_ENV=local|test|staging|production`
- `AUTH_MODE=local|google|test`
- `APP_BASE_URL`
- `SESSION_SECRETS`
- `CSRF_SECRET`
- `GOOGLE_AUTH_CLIENT_ID`
- `GOOGLE_AUTH_CLIENT_SECRET`
- `GOOGLE_AUTH_REDIRECT_URI`
- `GOOGLE_ALLOWED_DOMAINS`
- `AUTH_DEV_USER_EMAIL`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`
- `AUTH_BOOTSTRAP_ADMIN_ENABLED`

これらはLA-003で実装と同時に `.env.example`、デプロイ仕様、設定validationへ追加する。secretはGit、API response、画面、通常logへ出さない。

## 6. 初期admin

本番Userを通常seed dataへ混在させない。LA-003では冪等なbootstrap commandを用意する。

- `AUTH_BOOTSTRAP_ADMIN_ENABLED=true` と `BOOTSTRAP_ADMIN_EMAIL` の両方を必要とする
- emailを正規化し、存在しない場合だけactiveな `admin` を作成する
- 既存Userがinactiveまたは削除済みなら勝手に再有効化せず、明示的な管理対応を要求して失敗する
- 実行結果を監査またはsecurity logへ残すが、secretは残さない
- productionでは初回実行後にflagを無効化する
- 現行の `admin@example.com` はlocal/test seedとしてだけ扱う
- OAuthログイン自体はUser作成・role変更・inactive解除をしない

## 7. 認証APIと画面

LA-003では次のrouteを追加する。callback以外のAPI responseは既存の `{ data, meta, error }` envelopeに合わせる。

| Method | Path | 公開範囲 | 役割 |
|---|---|---|---|
| GET | `/login` | 公開 | ログイン画面。認証済みなら `/` へredirect |
| GET | `/api/auth/google/start` | 公開 | state/nonce/PKCEを作成しGoogleへredirect |
| GET | `/api/auth/google/callback` | 公開 | callback検証、session発行、同一originの許可済みpathへredirect |
| POST | `/api/auth/local-login` | local限定公開 | `AUTH_DEV_USER_EMAIL` のactive userでsession発行。bodyからemailを受け取らない |
| GET | `/api/auth/me` | 認証必須 | `{ id, email, name, role }` とCSRF tokenを返す |
| POST | `/api/auth/logout` | 認証・CSRF必須 | 現sessionを失効しCookieを削除 |

`returnTo` は `/`、`/leads-view`、`/mail-workspace`、`/today`、`/sales-performance`、`/replies` の相対pathだけ許可する。絶対URL、protocol-relative URL、未知のpathは `/` に置き換え、open redirectを防ぐ。

## 8. 保護範囲

### 8.1 公開するroute

- `GET /health`
- `GET /login`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/local-login`。ただしlocal条件を満たす場合だけ
- `GET /t/open/:emailId.png`
- `GET /t/click/:token`

公開routeは `@Public()` 相当のmetadataで明示する。path文字列の除外を複数箇所へ散らさない。

### 8.2 認証を必須にするroute

画面:

- `/`
- `/leads-view`
- `/mail-workspace`
- `/today`
- `/sales-performance`
- `/replies`

現行 `/replies` は `main.ts` のExpress instanceへ直接登録され、Nestのcontroller/guardを通らない。LA-003では表示内容とURLを変えずDashboardControllerへ移し、他画面と同じglobal authentication guardを通す。

API:

- `/api/auth/me`、`/api/auth/logout`
- `/api/companies/**`、`/api/contacts/**`
- `/api/projects/**`
- `/api/leads/**`、`/api/tasks/**`、`/api/opportunities/**`
- `/api/mails/**`、`/api/replies/**`
- `/api/ai/**`
- `/api/reports/**`、`/api/navigation-summary`
- `/api/t/links`、`/api/t/mails/**`
- 現行 `POST /api/unsubscribe`

現行unsubscribeはemailまたはcontact IDだけで状態を変えられるため、外部公開しない。将来メール受信者向けに公開する場合は、期限・対象を署名した専用tokenを必須にする別契約を作る。

原則は「すべて保護し、上記公開routeだけ除外」とする。新しいrouteは明示しない限り認証必須になる。

## 9. APIと画面の未認証時動作

- API: HTTP 401、code `AUTHENTICATION_REQUIRED`、表示用message `ログインしてください。`
- sessionはあるがUser不存在: session失効後401
- inactiveまたは削除済みUser: 全session失効後HTTP 403、code `USER_INACTIVE`
- HTML画面: `/login?returnTo=<許可済み相対path>` へ302 redirect
- Google/local login拒否: `/login?error=not_authorized` へredirectし、登録有無を表示しない

APIへHTML login画面を返さず、画面routeへJSON 401を返さない。

## 10. CSRFと同一オリジン

session Cookieを使うため、GET/HEAD/OPTIONS以外の業務APIは次を両方検証する。

1. `Origin` を許可済み同一オリジンと比較する。Originが送信されない例外requestは厳格なReferer検証へ限定する。
2. `/api/auth/me` で取得したCSRF tokenを `X-CSRF-Token` で送り、sessionに保存したhashとconstant-time比較する。

CSRF tokenはメモリ保持し、`localStorage`へ保存しない。login callback、公開tracking GET、healthはCSRF対象外。未認証状態のlocal loginもsession内CSRF tokenは要求せず、local mode、loopback bind、固定User、`APP_BASE_URL` との厳格なOrigin一致をすべて要求する。CORSは既定で無効のままとし、credential付きの任意originを許可しない。

## 11. current user契約

認証guardが確定した情報だけを `AuthenticatedPrincipal` として下流へ渡す。

```ts
type AuthenticatedPrincipal = {
  userId: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'viewer';
  sessionId: string;
};
```

Controller、use case、repositoryはrequest body、query、`X-Operator-Email`、localStorageからactorを組み立てない。

LA-003では認証とprincipal注入を実装し、案件取り込み、承認、分析、編集、レビュー、棄却、queue、送信記録、配信停止、商談操作へ同じprincipalを伝播する。固定 `manager`、`userId:null`、request由来actorを残さない。LA-004ではこのprincipalに基づくrole判定とAuditLog必須化を実装する。

組織IDは現行schemaにないため、LA-003で存在するふりをしない。LA-004も単一組織内のRBACと監査に限定する。`Organization`、`Membership`、全業務データのorganization scope、越境拒否は別のmulti-tenancy taskとして設計・実装する。それまでは単一組織運用に限定し、複数顧客向けproduction公開をしない。

LA-003だけが完了した状態では認証済みUserのrole別制限が未完成である。LA-004完了まではstaging/productionへ公開せず、`MAIL_SEND_ENABLED=false` を維持する。LA-007完了までは単一組織専用とし、複数顧客へ提供しない。

## 12. `X-Operator-Email` 廃止順

1. `AuthModule`、session、guard、`AuthenticatedPrincipal`、login/logoutを追加する。
2. サーバー側のproject importを `principal.userId` に変更し、`X-Operator-Email` を無視してemailによるUser自動作成・再有効化を停止する。
3. その他の重要操作にprincipalを伝播し、固定 `manager / userId:null` とrequest由来actorを廃止する。
4. client APIをCookie + CSRFへ切り替え、`localStorage` と `X-Operator-Email` の送信を停止する。
5. UI・API・integration testからheader依存が消れた時点で、domain field、adapter、localStorage keyを削除する。

互換flagは設けない。移行中も「sessionが無ければheaderへfallback」および「session userをheaderで上書き」は禁止する。

## 13. session失効

- logoutは対象sessionを即時失効しCookieを削除する
- passwordは管理しない。Google accountの失効だけに依存せず、`User.isActive=false` で全sessionを拒否する
- role変更時は既存sessionで次requestから最新roleをDB参照する。必要に応じて全sessionを失効する
- adminによる利用停止・削除時は対象Userの全sessionを失効する
- 期限切れ、revoked、token不一致は同じ401にし、理由を外部へ詳しく返さない
- session IDをログへ出してもtokenそのものは出さない

## 14. LA-003の実装順

1. config matrixと起動時validation
2. `UserSession` migration、repository、token/CSRF utility
3. `AuthModule`、principal decorator、global authentication guard、`@Public()`
4. local/test login、`me`、logout
5. login pageと共通clientのCookie/CSRF対応
6. Google start/callbackをprovider mockで実装
7. 全画面・APIをdefault protectedにし、公開routeだけmetadataで除外
8. `/replies` を同じURL・表示のままNest controllerへ移し、global guard配下に置く
9. 全重要操作のactorをsession userへ移行し、header自動User作成と固定actorを停止
10. OpenAPI、`.env.example`、security/deploy文書を実装値へ同期
11. unit、contract、integration、build、Sol監査

DB migrationとroute保護を同じ未検証変更に詰め込まず、上記単位でtestを通す。単一組織内のRBACと全AuditLogはLA-004へ残し、組織分離は別のmulti-tenancy taskへ分ける。

## 15. LA-003の必須テスト

- protected APIは未認証401、protected HTMLはloginへ302
- health、login、Google start/callback、open/click trackingだけが公開
- active local user login、`me`、logout後の再利用不可
- inactive、deleted、unknown userを拒否しUserを自動作成しない
- expired、idle expired、revoked sessionを拒否
- CookieのHttpOnly/SameSite/Secure環境差
- mutationのOrigin/CSRF欠落・不一致拒否
- OAuth state/nonce/PKCE/audience/email_verified不一致拒否
- 初回Google loginでsubjectをbindし、2回目以降はsubject一致を必須にする
- 異なるsubject、別Userへbind済みのsubject、emailだけのfallback loginを拒否する
- local loginがstaging/productionで使用不能で、legacy headerは全環境で認証・actor指定に使用不能
- 偽の `X-Operator-Email` だけでは認証・User作成・再有効化できない
- project importのAuditLog user IDがsession userと一致
- 商談・承認・分析等へsession userが渡り、偽造headerや固定actorで上書きされない
- logoutとinactive化が既存sessionを失効
- test helperはtest環境外で使用不能
- 既存API response envelopeと既存画面URLを維持
- `/replies` も他の保護画面と同じ未認証redirectになる

実Googleへの接続はtestで行わず、providerをmockする。browserとport 3000を使わずにcontract/integration testで確認できる構造にする。

## 16. Rollback

認証導入後の障害時も、staging/productionで全APIを無認証へ戻したりheaderを再度信用したりしない。

- applicationだけを直前versionへ戻す場合、追加したsession tableは残してよい
- Google callback障害時は新規loginを停止し、既存sessionを維持して修正する
- 緊急利用者追加はbootstrap commandまたは管理運用で事前登録し、open registrationを有効にしない
- local開発はlocal loginで継続する
- session secret漏えい時はsecretをrotateし、全sessionを失効する

## 17. 完了判定

LA-002は次を満たしたため設計完了とする。

- session方式を選び、JWTを採用しない理由を固定
- Google OAuth、local/test login、seed admin、logoutを固定
- public/protectedの画面・APIを列挙
- `X-Operator-Email` とUser自動作成の廃止順を固定
- CSRF、Cookie、inactive user、session失効を固定
- 単一組織制限とLA-004の境界を固定
- LA-003の実装順・必須test・rollbackを固定
