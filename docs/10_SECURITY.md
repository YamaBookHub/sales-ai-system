# 10_SECURITY

## セキュリティ

APIキー管理、個人情報、営業先情報、GitHub公開時の注意点を管理します。

- `OPENAI_API_KEY`、`GEMINI_API_KEY`、Gmail OAuth情報は `.env` だけに置き、APIレスポンス・ログ・Gitへ出さない。
- `GET /api/ai/usage-summary` は予算と概算費用だけを返し、APIキー、プロンプト、メール本文を返さない。
- OpenAI予算判定はDB上の予約を含め、複数人の同時操作で上限をすり抜けないようにする。
- `OPENAI_MONTHLY_BUDGET_USD` 未設定時は自動停止しないため、本番公開前に運用上限を設定する。
- 画面と業務APIは推測不能なsession Cookieで保護し、認証済みの変更操作はOriginとCSRF tokenを検証する。
- session tokenとCSRF tokenは平文でDBへ保存せず、hashだけを保存する。sessionは絶対24時間・無操作8時間で失効する。
- staging/productionはGoogle OAuth/OIDCだけを許可し、事前登録済みactive user以外を自動作成・再有効化しない。
- local loginはloopbackだけで有効で、固定した既存active user以外を選べない。
- Gmail送信用OAuthと利用者ログイン用Google OAuthは別credentialとして管理する。
- `SESSION_SECRETS` と `CSRF_SECRET` はstaging/productionで32文字以上とし、Git・画面・通常logへ出さない。
- role別の更新制限と全重要操作監査はLA-004で実装済み。組織別データ分離はLA-007で行うため、それまでは複数顧客向けに外部公開しない。
- roleは `viewer`、`operator`、`manager`、`admin` の4種、permissionは15種とし、全保護operationに明示的なmetadataを要求する。詳細は `docs/38_RBAC_AUDIT_CONTRACT.md` を参照する。
