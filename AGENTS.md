# AGENTS.md

このリポジトリは、営業AI支援ツールのMVPである。
AIが小さい変更範囲を安全に特定できることを、形式的なClean Architectureより優先する。

## 最初に読む

1. `docs/19_LOW_MODEL_HANDOFF.md`
2. `docs/22_AI_MODEL_ROUTING.md`
3. 変更対象moduleの `README.md`
4. `docs/18_AI_MAINTAINABLE_ARCHITECTURE.md`

## モデル選択

- 作業開始前に `docs/22_AI_MODEL_ROUTING.md` で作業リスクを判定する。
- 実行環境が対応している場合、ユーザーへの都度確認なしで適切なモデルまたはサブエージェントを選んでよい。
- 通常は Luna相当、小さく明確な変更は GPT-5.4 mini相当、複数責務の分離は Terra相当、設計・危険な変更・難しい障害は SolまたはGPT-5.5相当を使う。
- 低モデルで同じ原因への修正が2回失敗した場合は、修正を重ねず1段階上へ切り替える。
- モデル名が変わった場合は、名称ではなく同文書の役割定義を優先する。

## 設計方針

- 全体は Feature First Modular Monolith とする。
- `mail` / `ai` / `leads` / `projects` の複雑な部分だけを Clean Architecture 寄りに分ける。
- API入力は controller / dto、操作の流れは application、業務判断は domain、DB・外部APIは infrastructure に置く。
- 既存serviceは互換用の薄い入口として扱い、新しい業務ルールを増やさない。
- 抽象化は、実際に複雑さや重複を減らす場合だけ追加する。

## 絶対に守るルール

- AI生成メールは `draft` 保存までとし、自動送信しない。
- `approved` 以外のメールを `queued` にしない。
- checklist未完了のメールを承認・queueしない。
- 同じleadに重複メールを作らない。
- OpenAI失敗時に既存メールやlead状態を更新しない。
- OpenAI出力を検証せずDBへ保存しない。
- 外部取得元ごとの差分は `projects/infrastructure/*provider.ts` に閉じ込める。
- ユーザーの既存変更や未追跡ファイルを勝手に削除・巻き戻ししない。

## 変更場所

- メール状態遷移: `apps/api/src/mail/domain/mail-policy.ts`
- メール操作: `apps/api/src/mail/application/`
- メールDB更新: `apps/api/src/mail/infrastructure/prisma-mail-workflow.repository.ts`
- AIプロンプト: `apps/api/src/ai/prompts/`
- AI出力検証・文面ルール: `apps/api/src/ai/domain/`
- OpenAI通信: `apps/api/src/ai/openai-client.service.ts`
- リード判断・点数: `apps/api/src/leads/domain/`
- 案件取得元: `apps/api/src/projects/infrastructure/`
- 案件取り込みルール: `apps/api/src/projects/domain/`
- 案件DB保存: `apps/api/src/projects/infrastructure/prisma-project-import.repository.ts`

## 変更手順

1. 対象moduleのREADMEと既存テストを読む。
2. 変更範囲を1module、できれば1usecaseに限定する。
3. 重要ルールを変更した場合は同じ責務の `*.spec.ts` を更新する。
4. `npm run build` を実行する。
5. `npm test -- --runInBand` を実行する。
6. APIやDB仕様を変えた場合だけ関連docsも更新する。

大規模な一括リファクタリングは行わない。次の作業は `docs/19_LOW_MODEL_HANDOFF.md` の優先順位から1件ずつ進める。
