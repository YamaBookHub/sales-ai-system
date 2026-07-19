# performance module

期間・担当者・取得元別の営業成績を、ページ表示件数ではなくDB正本から集計する。

## 境界

- API: `sales-performance.controller.ts` / `sales-performance.dto.ts`
- 集計の流れ: `application/get-sales-performance.usecase.ts`
- 期間、分母、率、表示名: `domain/sales-performance.ts`
- DB契約: `domain/sales-performance.repository.ts`
- Prisma集計: `infrastructure/prisma-sales-performance.repository.ts`

## 指標定義

- 期間: `Asia/Tokyo`の日付で両端を含む。省略時は当日を含む直近30暦日。
- 母集団: 期間内に実送信日時`OutreachEmail.sentAt`を持ち、`EmailEvent.type = sent`で裏付けられた非削除Lead。イベント登録日は集計日付に使わない。
- 送信数: 重複イベントを除いた`OutreachEmail`件数。メール、サイトDM、問い合わせフォームを含む。
- 接触リード: 送信数から重複Leadを除いた件数。
- 返信: 母集団の送信後に`EmailReply`が1件以上あるLead。
- 商談・受注: 母集団の送信後に`OpportunityStageHistory`で各stageへ到達したLead。
- 失注: 母集団のうち現在`Opportunity.stage = lost`で、送信後に失注したLead。
- 返信率、商談率、受注率: すべて接触リード数を分母とする。0件時は0。
- 担当者: 現在の`Opportunity.ownerId`で絞る。
- 担当者候補: 現在Opportunityを持つ利用者。過去成績の確認用に無効化済み利用者も含む。
- 取得元: `SalesLead.project.platform.type`。案件なしは`manual`。

## 重要ルール

- `SalesLead.status`を営業成績に使用しない。
- 現在ページの一覧データを集計しない。
- 同じメールへの複数返信、同じstageへの複数履歴はLead単位で1件にする。
- UIは`GET /api/reports/sales-performance`の値を表示するだけで再計算しない。
