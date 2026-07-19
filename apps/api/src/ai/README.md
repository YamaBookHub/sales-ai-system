# ai module

## 役割
リード分析、営業メール下書き生成、既存メールの整形、返信分類を担当する。

## 触ってよい場所
- API変更: `ai.controller.ts` / `ai.dto.ts`
- 業務操作: `application/*.usecase.ts`
- リード分析保存: `application/analyze-lead.usecase.ts`
- 構造化分析の保存・確認・履歴: `application/lead-analysis.usecase.ts`
- メールに使える確認済み分析の検証: `application/confirmed-analysis.reader.ts`
- AI生成履歴一覧: `application/list-lead-generations.usecase.ts`
- メール意味整合性確認: `application/check-mail-semantic-consistency.usecase.ts`
- AI provider振り分け: `ai-client.service.ts`
- Gemini呼び出し: `gemini-client.service.ts`
- OpenAI呼び出し: `openai-client.service.ts`
- OpenAI月額予算・同時実行予約: `application/openai-budget.service.ts`
- OpenAI予算計算: `domain/openai-budget.ts`
- プロンプト本文: `prompts/*.prompt.ts`
- AI出力検証: `domain/ai-output-validator.ts`
- AI生成メールの安定化: `domain/openai-sales-mail-draft.ts`
- 意味整合性のJSON検証: `domain/semantic-consistency.ts`
- 件名などの共通ルール: `domain/mail-draft-rules.ts`
- OpenAIを使わないローカルリード分析: `domain/local-lead-analysis.ts`
- 構造化分析の正規化・案件fingerprint: `domain/lead-analysis.ts`
- OpenAIを使わないローカル下書き生成: `domain/local-mail-draft.ts`
- 返信分類ルール: `domain/reply-classifier.ts`

## 重要ルール
- AI生成メールは下書き保存まで。自動送信しない
- 外部AI失敗時に既存メールやリード状態を壊さない
- プロンプトは事実ベース、低圧、断定的な成果保証なし
- Gemini 3.5 FlashとSOLは判断重視、Gemini 3.1 Flash-Lite、GPT-4.1 mini、LUNAは手順重視のメール指示を使用する
- 既定モデルは `gemini-3.1-flash-lite`。全モデルが同じJSON契約と `docs/08_MAIL.md` の正本に従う
- メール画面で選択したGemini/OpenAIモデルは、AI整形と意味確認のリクエストに適用する
- 画面から指定できるモデルは `SELECTABLE_AI_MODELS` の許可リストに限定し、未指定時は `AI_DEFAULT_MODEL`、互換用 `OPENAI_MODEL` の順にフォールバックする
- 会社名・商品名・商品特徴は人間確認前提
- AI意味確認は任意の助言であり、メール・Lead・承認状態を更新しない
- AI意味確認が成功しても、人間の本文確認を省略しない
- メール生成は、現在案件と一致する最新の確認済み構造化分析3項目だけを使う
- 構造化分析は既存版を更新せず、新しいversionとして追加する
- 自由文メモと過去のAIログをメール生成時の構造化分析へfallbackしない
- 案件編集・再取り込み・分析保存・メール生成は `lead-analysis:{leadId}` の排他境界を共有する
- OpenAI呼び出しは `AiClientService` から予算予約を通し、上限超過時は通信前に停止する
- Geminiとローカル生成はOpenAI月額予算の影響を受けない

## AI向け注意
provider振り分けを変える場合は `ai-client.service.ts`。Gemini/OpenAI APIの呼び方を変える場合は各providerのclient service。共通プロンプトを変える場合は `prompts/sales-mail-draft.prompt.ts` または `prompts/semantic-consistency.prompt.ts`。AI生成後の本文安定化を変える場合は `domain/openai-sales-mail-draft.ts`。意味整合性の出力形式を変える場合は `domain/semantic-consistency.ts`。無料/ローカル分析の判断ルールを変える場合は `domain/local-lead-analysis.ts`。無料/ローカル生成の文面ルールを変える場合は `domain/local-mail-draft.ts`。返信分類の判定語句やステータスを変える場合は `domain/reply-classifier.ts`。分析3項目の版管理を変える場合は `application/lead-analysis.usecase.ts` と `domain/lead-analysis.ts`、分析生成ログとの接続を変える場合は `application/analyze-lead.usecase.ts`。
