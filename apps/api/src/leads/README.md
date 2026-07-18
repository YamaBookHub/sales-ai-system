# leads module

## 役割
営業対象リードの一覧、候補状態、優先度、メモ、次アクションを管理する。商談段階・担当・確度・金額などのCRMパイプラインは`Opportunity`で管理する。

## 触ってよい場所
- API変更: `leads.controller.ts` / `leads.dto.ts`
- 業務操作: `leads.service.ts` / `application/`
- 状態・優先度・次アクションの業務ルール: `domain/lead-policy.ts`
- 次回対応の状態遷移: `domain/task-policy.ts`
- 次回対応のAPI操作: `tasks.controller.ts` / `application/*task*.usecase.ts`
- スコア計算ルール: `domain/lead-score.ts`
- DB保存: `infrastructure/`

## 重要ルール
- リード状態はメール状態と連動する
- スコア計算式は `domain/lead-score.ts` に集約する
- スコアから優先度を補完する場合は `domain/lead-policy.ts` の `priorityForScore` を使う
- 次アクション日時・次回フォロー日時の既定値は `applyLeadPolicy` に集約する
- `rejected` / `archived` のような終端状態では未処理の次アクションを残さない
- 明示的に入力された優先度・日時は、終端状態のクリア規則を除いて尊重する
- Taskの `todo` / `doing` だけを未完了の次回対応として表示する
- Taskの `doneAt` は `status = done` のときだけ保存する
- Taskの担当者は `User.isActive = true` の既存Userだけを受け付ける

## Opportunity API

`Opportunity`は`SalesLead`と1対1で対応する商談パイプラインである。`SalesLead.status`は候補選定・メール・返信対応の互換状態として残し、商談率・受注率・失注理由の集計には使わない。

### ルート

- `GET /api/opportunities`: サーバー側ページング付き商談一覧。stage、owner、取得元、受注見込日の条件を受け付ける。
- `GET /api/leads/:leadId/opportunity`: 商談の現在値と直近履歴。
- `PATCH /api/leads/:leadId/opportunity`: 担当、確度、金額、予定日を`expectedVersion`付きで更新。
- `POST /api/leads/:leadId/opportunity/transitions`: `operationKey`付きで状態遷移。
- `POST /api/leads/:leadId/opportunity/reopen`: `lost` / `excluded`の再開。
- `GET /api/leads/:leadId/opportunity/history`: 状態履歴のページング取得。

### 実装ルール

- 通常遷移は`uncontacted`→`contacted`→`replied`→`meeting`→`proposal`→`won` / `lost`。営業対象外は`excluded`。
- 状態・項目更新は楽観ロックを使う。クライアントは取得した`version`を`expectedVersion`に入れ、409なら再取得して再操作する。
- 状態変更履歴は追記専用。`operationKey`は同一操作の再送を冪等化し、履歴には変更元・変更元ID・versionAfter・snapshotを残す。
- メール送信・返信記録からのシステム連動は前方遷移だけで、提案・受注・失注を巻き戻さない。
- 終端状態への遷移ではLeadの次回対応日時を消し、未完了Taskをcancelledにする。

## AI向け注意
今後リード判断が複雑になったら、`leads.service.ts` に直接増やさず、状態・優先度・次アクションは `domain/lead-policy.ts`、点数計算は `domain/lead-score.ts` に純粋関数として追加する。
DBや外部サービスが必要な処理は `application` / `infrastructure` へ分離する。スコア更新は `application/score-lead.usecase.ts` と `infrastructure/prisma-lead.repository.ts` を見る。
TaskのAPI・DB queryを変える場合は `tasks.controller.ts`、`application/`、`infrastructure/prisma-task.repository.ts`、`domain/task-policy.ts` を確認する。

## テスト
- 業務ルールは `domain/*.spec.ts` に追加する
- usecaseのテストは `application/*.spec.ts` に追加する
- サービスのテストはDB境界やDTO変換を確認したい場合だけ追加する
