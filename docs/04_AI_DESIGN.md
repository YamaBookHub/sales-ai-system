# 04_AI_DESIGN

## AI設計

使用モデル、入力データ、出力JSON、コスト制御、失敗時の扱いを管理します。

## メール下書き生成

`POST /api/ai/leads/{id}/email-draft` はOpenAI APIへ接続し、リード・企業・CAMPFIREプロジェクト情報をもとに営業メール下書きを作成します。

- 入力は会社名、プロジェクト名、URL、カテゴリ、説明文、支援額、支援者数、リード理由に限定する。
- CAMPFIREページのHTML全文はAIへ送らない。
- 生成結果は `OutreachEmail` に `draft` として保存する。
- AI実行ログは `AiGeneration` に保存し、入力、出力、利用トークン、レイテンシを残す。
- `OPENAI_INPUT_COST_PER_1M` と `OPENAI_OUTPUT_COST_PER_1M` が設定されている場合のみ、概算コストを保存する。
- メール送信は自動化しない。送信前にレビュー・承認フローを通す。

## 環境変数

```env
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4.1-mini"
OPENAI_MAX_DESCRIPTION_CHARS="1200"
OPENAI_MAX_OUTPUT_TOKENS="1200"
OPENAI_INPUT_COST_PER_1M=""
OPENAI_OUTPUT_COST_PER_1M=""
```

## エラー時の扱い

- APIキー未設定: 日本語メッセージで503を返す。
- APIキー不正: 日本語メッセージで502を返す。
- 残高不足・利用上限: 日本語メッセージで502を返す。
- OpenAI応答がJSONでない場合: 下書きを保存せず502を返す。
