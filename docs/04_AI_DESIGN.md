# 04_AI_DESIGN

## AI設計

使用モデル、入力データ、出力JSON、コスト制御、失敗時の扱いを管理します。

## メール下書き生成

`POST /api/ai/leads/{id}/email-draft` は外部AI APIを使わず、リード・企業・クラウドファンディング情報から初期下書きを作成する。既存下書きの「AIで整える」と「AIで意味を確認」では、画面で選択したGemini APIまたはOpenAI APIを使用する。

- 入力は会社名、プロジェクト名、URL、カテゴリ、説明文、支援額、支援者数、リード理由に限定する。
- CAMPFIREページのHTML全文はAIへ送らない。
- 生成結果は `OutreachEmail` に `draft` として保存する。
- AI実行ログは `AiGeneration` に保存し、入力、出力、利用トークン、レイテンシを残す。
- 外部AIによる整形では利用モデル、provider、利用トークン、レイテンシ、概算コストを `AiGeneration` に保存する。
- 件名、宛名、固定自己紹介、固定実績、最後の質問はアプリ側でも補正し、テンプレートの最低限の形を保つ。
- 件名は `CAMPFIREでのプロジェクトを拝見しご連絡いたしました` に固定する。
- 本文は `docs/08_MAIL.md` のCAMPFIRE営業メール定型文を正本とし、AIは現在のプロジェクト名、案件種別、案件固有の魅力、対象者を入力事実の範囲で埋める。
- 過去商品や別案件の傾向は、現在のプロジェクトと明確に一致しない限り本文へ入れない。
- 本文は営業メールとして読みやすい段落に整える。1段落ごとに空行を1つだけ入れ、読点 `、` の直後や1文の途中で空行を入れない。
- メール送信は自動化しない。送信前にレビュー・承認フローを通す。

## モデル別の指示設計

選択したモデルからメール下書き用の指示を自動選択する。モデルの非公開な内部アルゴリズムを仮定せず、複雑な判断を任せられる範囲と、指示を安定して再現できる粒度の違いで設計する。

| モデル | 主な用途 | 指示の考え方 |
|---|---|---|
| `gemini-3.1-flash-lite` | 通常運用、大量生成、コスト最優先 | LUNA向けと同じく、分類、抽出、固定順序、禁止事項、最後の自己確認を順番に明示する。thinking levelは `minimal` |
| `gemini-3.5-flash` | 自然さと品質を優先する生成 | SOL向けと同じく、目的、事実制約、品質基準、出力JSONを明示し、案件固有の魅力の選択はモデルに任せる。thinking levelは `low` |
| `gpt-4.1-mini` | 旧既定モデルとの比較、低コストのOpenAI運用 | 推論ステップを持たない旧モデルとして、LUNA向けの明示的な手順と固定順序を使用する |
| `gpt-5.6-sol` または `gpt-5.6` | 判断が難しい案件、自然さを優先する生成 | 返信を得やすい低圧な初回接触という目的、事実制約、品質基準、出力JSONを明示し、案件固有の魅力の選択と自然な表現はモデルに任せる |
| `gpt-5.6-luna` | OpenAI互換運用 | 商品/取り組みの分類、魅力1つの抽出、対象者の確認、固定順序、禁止事項、最後の自己確認を順番に明示する |

全モデルの出力は `subject`、`body`、`factsUsed`、`assumptions`、`riskFlags` のJSONに統一する。モデルが変わっても固定実績や最後の質問は変えず、生成後にアプリ側の正本へ補正する。既定モデルは `gemini-3.1-flash-lite` とする。

メール画面ではGemini 3.1 Flash-Lite、Gemini 3.5 Flash、GPT-4.1 mini、5.6 LUNA、5.6 SOLを選択できる。選択値は「AIで整える」と「AIで意味を確認」にリクエスト単位で適用する。APIでモデルを省略した場合は `AI_DEFAULT_MODEL`、互換用の `OPENAI_MODEL`、`gemini-3.1-flash-lite` の順に解決する。画面から指定できるモデルはサーバー側の許可リストに限定する。

「AI分析」と最初の下書き生成は現状ローカル処理であり、モデル選択の影響を受けない。

## 環境変数

```env
AI_DEFAULT_MODEL="gemini-3.1-flash-lite"
GEMINI_API_KEY=""
GEMINI_MAX_DESCRIPTION_CHARS="1200"
GEMINI_MAX_OUTPUT_TOKENS="1600"
GEMINI_SEMANTIC_CHECK_MAX_OUTPUT_TOKENS="600"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.6-luna"
OPENAI_MAX_DESCRIPTION_CHARS="1200"
OPENAI_MAX_OUTPUT_TOKENS="1200"
OPENAI_SEMANTIC_CHECK_MAX_OUTPUT_TOKENS="400"
OPENAI_MONTHLY_BUDGET_USD=""
OPENAI_ESTIMATED_COST_PER_REQUEST_USD="0.01"
OPENAI_INPUT_COST_PER_1M=""
OPENAI_OUTPUT_COST_PER_1M=""
```

Geminiの概算単価は2026-07-16時点の標準有料枠を既定値とする。Flash-Liteは入力 `$0.25` / 出力 `$1.50`、Flashは入力 `$1.50` / 出力 `$9.00`（いずれも100万トークンあたり、出力はthinking tokenを含む）。価格変更時は `.env` のモデル別単価で上書きする。無料枠では入力データがGoogleの製品改善に使われる設定であるため、営業先データを扱う本番運用では有料枠のデータ取扱条件を確認する。

## OpenAI月額予算guard

- `OPENAI_MONTHLY_BUDGET_USD` を空欄にすると利用額だけを記録し、自動停止しない。
- 金額を設定すると、JSTの月初から翌月初までの確定概算費用と実行中予約を合算する。
- OpenAI実行前に概算費用をDBへ予約し、同時操作でも予算残額を二重利用しない。
- 料金単価が設定済みなら入力文字数と最大出力tokenから見積もり、未設定なら `OPENAI_ESTIMATED_COST_PER_REQUEST_USD` を使う。
- 予算設定時に見積額を0または不正値へ設定すると、guardを無効化せず503で停止する。
- 上限を超える実行はOpenAI通信前に429と日本語メッセージで拒否する。
- Gemini、ローカル分析、ローカルメール生成はOpenAI予算の影響を受けない。
- `GET /api/ai/usage-summary` で当月の概算利用額、予約中金額、残額、停止状態を確認できる。APIキーは返さない。

## エラー時の扱い

- APIキー未設定: 日本語メッセージで503を返す。
- APIキー不正: 日本語メッセージで502を返す。
- 残高不足・利用上限: 日本語メッセージで502を返す。
- AI応答がJSONでない場合: 下書きを保存せず502を返す。
- OpenAI月額予算超過: OpenAI通信を行わず、日本語メッセージで429を返す。
