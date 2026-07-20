# 12_DEPLOY

## デプロイ

ローカル運用、GitHub管理、将来的なVercel/Supabase公開手順を管理します。

- localでは `APP_ENV=local`、`AUTH_MODE=local`、`APP_BASE_URL=http://127.0.0.1:3000`、`AUTH_DEV_USER_EMAIL` を設定する。
- staging/productionでは `AUTH_MODE=google`、HTTPSの `APP_BASE_URL`、Google認証credential、32文字以上のsession/CSRF secretを設定する。
- 初期管理者は通常seedと分離し、`AUTH_BOOTSTRAP_ADMIN_ENABLED=true` と `BOOTSTRAP_ADMIN_EMAIL` を設定して `npm run auth:bootstrap-admin` を一度だけ実行する。完了後はflagをfalseへ戻す。
- migration適用前の起動では `UserSession` tableがないためログインできない。先にmigrationを適用する。
- LA-004のRBAC・全操作監査は完了済み。ただしLA-007の組織分離、LA-005のjob所有者、LA-006の復元確認が終わるまでは複数顧客向けに外部公開しない。
- LA-004の追加DB変更はAuditLogのsessionIdと検索indexのみで、既存監査行を削除するdown migrationは行わない。問題時は旧アプリrevisionへ戻し、実送信は無効のまま復旧する。
