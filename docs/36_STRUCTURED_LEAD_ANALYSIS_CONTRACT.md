# 36_STRUCTURED_LEAD_ANALYSIS_CONTRACT

## 目的

`LM-004` の正本として、メール生成前に確認する次の3項目を案件単位で保存し、編集履歴と確認状態を保持する。

- 商品・企画の魅力
- 想定する相手
- 動画での見せ方

メール生成は、現在案件と一致する確認済み分析だけを使用する。自由文の `brandAnalysisMemo` と `snsAnalysisMemo`、過去の `AiGeneration.outputJson` は正本として扱わない。

## 設計判断

### 追記専用の分析版を持つ

`LeadAnalysisRevision` を追加し、AI分析、手動保存、確認のたびに新しいversionを作る。既存版を更新・削除するAPIは作らない。

`AiGeneration` は生成入出力のログとして残す。現在メールへ使用できる値の判定には利用しない。

### メールへ使用版を固定する

`OutreachEmail.analysisRevisionId` に、下書き生成時に使用した確認済み分析版を保存する。後から再分析・再編集されても、既存メールの根拠を別の分析へ差し替えない。

### 案件変更はfingerprintで検知する

`projectId` の一致だけでは、案件名・説明・URL・カテゴリの編集を検知できない。分析作成時の案件情報から `sourceFingerprint` を計算し、現在値と異なる分析は `stale` として扱う。

`stale` はDBへ保存せず、読込時とメール生成直前に計算する。

## DB契約

### enum

```prisma
enum LeadAnalysisStatus {
  draft
  confirmed
}

enum LeadAnalysisOrigin {
  generated
  manual
  migration
}
```

### LeadAnalysisRevision

```prisma
model LeadAnalysisRevision {
  id                 String             @id @default(uuid()) @db.Uuid
  leadId             String             @db.Uuid
  projectId          String             @db.Uuid
  sourceGenerationId String?            @db.Uuid
  changedById        String?            @db.Uuid
  version            Int
  status             LeadAnalysisStatus @default(draft)
  origin             LeadAnalysisOrigin
  appeal             String?
  targetUser         String?
  videoIdea          String?
  sourceFingerprint  String
  generatedAt        DateTime?
  confirmedAt        DateTime?
  humanEdited        Boolean            @default(false)
  editedFields       String[]           @default([])
  createdAt          DateTime            @default(now())

  @@unique([leadId, version])
  @@index([leadId, status, version])
  @@index([projectId])
}
```

relation:

- `SalesLead.analysisRevisions`
- `CrowdfundingProject.analysisRevisions`
- `AiGeneration.analysisRevisions`
- `User.leadAnalysisChanges`
- `OutreachEmail.analysisRevision`

`changedById` は認証導入前はnullを許可する。認証後は操作ユーザーを保存する。

## versionと排他

- Lead単位のtransaction advisory lockを取得してからversionを採番する。
- `PATCH` と確認APIは `expectedVersion` を必須にする。
- 最新versionが異なる場合は409で拒否し、画面へ再読込を促す。
- 案件詳細更新と分析確認は共通の `lead-analysis:{leadId}` lockを使い、確認中の案件変更を防ぐ。

## 分析生成

`POST /api/ai/leads/{leadId}/analyze` は次を行う。

1. 現在案件を取得する。案件がなければ409。
2. 無料分析を生成し、従来どおり `AiGeneration` を保存する。
3. `mailPlaceholders.appeal`、`mailPlaceholders.targetUser`、`mailPlaceholders.videoIdea` を構造化値として新しいdraft版へ保存する。
4. 既存のconfirmed版は更新しない。
5. 生成値が不足していてもdraft保存は許可し、不足項目を画面に表示する。

## 手動編集と確認

### 下書き保存

`PATCH /api/ai/leads/{leadId}/analysis`

```json
{
  "expectedVersion": 3,
  "appeal": "商品の魅力",
  "targetUser": "想定する相手",
  "videoIdea": "短尺動画での見せ方"
}
```

- 空欄を含む保存を許可する。
- 新しいdraft版を追加する。
- `humanEdited = true` とする。
- `editedFields` は直前版との差分からサーバーが計算する。

### 確認

`POST /api/ai/leads/{leadId}/analysis/confirm`

- requestは下書き保存と同じ3値と `expectedVersion` を受け取る。
- 3値がすべて入力済みの場合だけconfirmed版を追加する。
- `confirmedAt` をサーバー時刻で保存する。
- 案件が更新済み、またはversion競合の場合は409。

## 取得API

`GET /api/ai/leads/{leadId}/analysis`

response data:

- `proposal`: 最新version
- `confirmed`: 現在案件とfingerprintが一致する最新confirmed版
- `history`: 直近20件
- `missingFields`: `appeal`、`targetUser`、`videoIdea` の不足一覧
- `stale`: proposalまたはconfirmedが現在案件から古いか
- `canGenerateMail`: 確認済み・3値入力済み・同一案件・fingerprint一致の場合だけtrue

## メール生成

`GenerateMailDto.analysisRevisionId` を必須にする。

生成直前に次を同じtransaction内で再確認する。

1. 分析版が存在する。
2. 対象Leadとprojectに一致する。
3. statusがconfirmedである。
4. 3値がすべて非空である。
5. sourceFingerprintが現在案件と一致する。
6. 指定版が現在利用可能な最新confirmed版である。

違反時は409で停止し、メール、Lead状態、`AiGeneration` を作成しない。

本文と定型文変数には `appeal`、`targetUser`、`videoIdea` をそのまま渡す。自由文メモからのfallbackは禁止する。

## 既存メールとAI整形

- 既存メールはmigrationで分析版を自動関連付けしない。
- LM-004以後に生成したメールは `analysisRevisionId` を必ず持つ。
- AI整形はメールに固定された分析版だけを参照する。
- 再分析後も既存メールの入力を最新分析へ切り替えない。

## migration

1. enum、`LeadAnalysisRevision`、nullableなメールFKを追加する。
2. Leadごとの最新 `project_summary` からdraft版をbackfillする。
3. 魅力と対象者は `outputJson.mailPlaceholders`、動画案は `mailPlaceholders.videoIdea` または `snsIdeas[0]` から取得する。
4. 自由文メモはbackfill元にしない。
5. backfill版は `origin = migration`、`status = draft` とし、自動確認しない。
6. 既存メール本文と状態は変更しない。

## 合格条件

- 3値を生成前に表示、編集、保存、確認できる。
- 未分析、未確認、不足、staleを画面で区別できる。
- 確認前はメール生成ボタンが無効で、API直接呼出しも409になる。
- 再分析が確認済み版を上書きしない。
- version競合、別案件、fingerprint不一致を拒否する。
- メールが使用した分析版を追跡できる。
- 米びつ、食品、イベント、生活用品の分析が別案件へ混入しない。
- OpenAPI、Prisma、unit/contract、実DBintegration、buildが成功する。

