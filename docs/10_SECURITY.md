# 10_SECURITY

## セキュリティ

APIキー管理、個人情報、営業先情報、GitHub公開時の注意点を管理します。

- `OPENAI_API_KEY`、`GEMINI_API_KEY`、Gmail OAuth情報は `.env` だけに置き、APIレスポンス・ログ・Gitへ出さない。
- `GET /api/ai/usage-summary` は予算と概算費用だけを返し、APIキー、プロンプト、メール本文を返さない。
- OpenAI予算判定はDB上の予約を含め、複数人の同時操作で上限をすり抜けないようにする。
- `OPENAI_MONTHLY_BUDGET_USD` 未設定時は自動停止しないため、本番公開前に運用上限を設定する。
