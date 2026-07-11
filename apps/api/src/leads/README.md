# leads module

## 役割
営業対象リードの一覧、状態、優先度、メモ、次アクションを管理する。

## 触ってよい場所
- API変更: `leads.controller.ts` / `leads.dto.ts`
- 業務操作: `leads.service.ts` / `application/`
- 状態・優先度・次アクションの業務ルール: `domain/lead-policy.ts`
- スコア計算ルール: `domain/lead-score.ts`
- DB保存: `infrastructure/`

## 重要ルール
- リード状態はメール状態と連動する
- スコア計算式は `domain/lead-score.ts` に集約する
- スコアから優先度を補完する場合は `domain/lead-policy.ts` の `priorityForScore` を使う
- 次アクション日時・次回フォロー日時の既定値は `applyLeadPolicy` に集約する
- `rejected` / `archived` のような終端状態では未処理の次アクションを残さない
- 明示的に入力された優先度・日時は、終端状態のクリア規則を除いて尊重する

## AI向け注意
今後リード判断が複雑になったら、`leads.service.ts` に直接増やさず、状態・優先度・次アクションは `domain/lead-policy.ts`、点数計算は `domain/lead-score.ts` に純粋関数として追加する。
DBや外部サービスが必要な処理は `application` / `infrastructure` へ分離する。スコア更新は `application/score-lead.usecase.ts` と `infrastructure/prisma-lead.repository.ts` を見る。

## テスト
- 業務ルールは `domain/*.spec.ts` に追加する
- usecaseのテストは `application/*.spec.ts` に追加する
- サービスのテストはDB境界やDTO変換を確認したい場合だけ追加する
