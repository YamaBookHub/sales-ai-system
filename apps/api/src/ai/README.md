# ai module

## 役割
リード分析、営業メール下書き生成、既存メールの整形、返信分類を担当する。

## 触ってよい場所
- API変更: `ai.controller.ts` / `ai.dto.ts`
- 業務操作: `application/*.usecase.ts`
- リード分析保存: `application/analyze-lead.usecase.ts`
- AI生成履歴一覧: `application/list-lead-generations.usecase.ts`
- メール意味整合性確認: `application/check-mail-semantic-consistency.usecase.ts`
- OpenAI呼び出し: `openai-client.service.ts`
- プロンプト本文: `prompts/*.prompt.ts`
- OpenAI出力検証: `domain/ai-output-validator.ts`
- OpenAI生成メールの安定化: `domain/openai-sales-mail-draft.ts`
- 意味整合性のJSON検証: `domain/semantic-consistency.ts`
- 件名などの共通ルール: `domain/mail-draft-rules.ts`
- OpenAIを使わないローカルリード分析: `domain/local-lead-analysis.ts`
- OpenAIを使わないローカル下書き生成: `domain/local-mail-draft.ts`
- 返信分類ルール: `domain/reply-classifier.ts`

## 重要ルール
- AI生成メールは下書き保存まで。自動送信しない
- OpenAI失敗時に既存メールやリード状態を壊さない
- プロンプトは事実ベース、低圧、断定的な成果保証なし
- 会社名・商品名・商品特徴は人間確認前提
- AI意味確認は任意の助言であり、メール・Lead・承認状態を更新しない
- AI意味確認が成功しても、人間の本文確認を省略しない

## AI向け注意
モデルAPIの呼び方を変える場合は `openai-client.service.ts`。OpenAIプロンプトを変える場合は `prompts/sales-mail-draft.prompt.ts` または `prompts/semantic-consistency.prompt.ts`。OpenAI生成後の本文安定化を変える場合は `domain/openai-sales-mail-draft.ts`。意味整合性の出力形式を変える場合は `domain/semantic-consistency.ts`。無料/ローカル分析の判断ルールを変える場合は `domain/local-lead-analysis.ts`。無料/ローカル生成の文面ルールを変える場合は `domain/local-mail-draft.ts`。返信分類の判定語句やステータスを変える場合は `domain/reply-classifier.ts`。リード分析の保存フローを変える場合は `application/analyze-lead.usecase.ts`。
