# 26_NEXT_ACTION_DESIGN

## 結論

次回対応は `SalesLead` の項目を増やして表現せず、既存の `Task` モデルを正本として実装する。

- 新しいDBモデルは不要。
- 新しいmigrationもG06時点では不要。
- `SalesLead.nextActionAt` と `nextFollowUpAt` は既存画面との互換用に残す。
- 対応内容、担当、完了状態、履歴は `Task` に保存する。
- `Task` の最新未完了行をLeadの `nextTask` としてAPIに追加し、今日の営業画面はそれを優先して表示する。

この方針なら、Leadに `taskTitle`、`assignee`、`done` などを追加する不自然な1件固定設計を避けられる。

## G06の読み取り結果

### 既存データ

| データ | 現在の項目 | 判断 |
|---|---|---|
| `SalesLead` | `nextActionAt`、`nextFollowUpAt`、`ownerMemo`、`status` | 日時とメモは持てるが、対応単位の履歴・担当・完了状態は持てない |
| `EmailReply` | `nextAction`、`receivedAt`、`category` | 返信分類からの助言。営業担当が確定したTaskの保存先ではない |
| `Task` | `leadId`、`assigneeId`、`title`、`description`、`status`、`dueAt`、`doneAt` | 次回対応に必要な項目が既に揃っている |
| `User` | `id`、`name`、`email`、`role`、`isActive` | Taskの担当者relationが既にある |

### 現在の実装境界

- `Task` のPrisma modelと初期migrationは存在する。
- Taskを読み書きするcontroller、DTO、usecase、repositoryは存在しない。
- `GET /api/leads` と `GET /api/leads/:id` はTaskを返していない。
- `PATCH /api/leads/:id` は既存のLead項目更新用であり、Taskのtitle・assignee・statusを受ける設計ではない。
- docsには `POST /api/ai/leads/{id}/next-action` の記載があるが、現行controller/serviceには実装がない。AI提案と確定した次回対応の保存を同じAPIにしない。
- 認証・現在ユーザーの仕組みはまだないため、担当者の選択は `User.isActive` を使うローカルMVPの一覧に限定する。認可の代替にはしない。

## なぜLead更新だけでは足りないか

Lead更新だけで扱えるのは、主に「そのLeadの次の日時」と「メモ」である。次の要件が入るとTaskが必要になる。

- 同じLeadに複数の対応予定を持つ。
- 対応内容と担当者を日時から分離する。
- 完了した対応を履歴として残す。
- 返信後の「資料送付」「日程候補送付」「数日後の再確認」を別の作業として扱う。
- 完了済みの対応と、現在の次回対応を同時に表示する。

したがって `LeadsService.update()` は既存の営業情報更新に再利用するが、Taskの作成・状態遷移をその中へ埋め込まない。

## 次回対応のdata契約

### Task表示モデル

```ts
type NextActionTask = {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done' | 'cancelled';
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};
```

`GET /api/leads` と `GET /api/leads/:id` には、既存レスポンスを壊さない追加項目として次を返す。

```ts
type LeadNextActionSummary = {
  nextTask: NextActionTask | null;
  activeTaskCount: number;
};
```

`nextTask` は `status in [todo, doing]` のTaskから、次の順で1件を選ぶ。

1. `dueAt` があるTaskを先にする。
2. `dueAt` の古い順にする。
3. `dueAt` が同じ場合は `createdAt` の古い順にする。
4. `dueAt` がないTaskは最後にする。

一覧で全Taskを毎回返す必要はない。Task詳細・履歴が必要な画面はTask専用APIを使う。

## Taskの状態遷移

### 状態の意味

| Status | 意味 | 次回対応として表示 |
|---|---|---:|
| `todo` | 未着手 | 表示する |
| `doing` | 対応中 | 表示する |
| `done` | 完了 | 表示しない |
| `cancelled` | 取り消し | 表示しない |

### 許可する遷移

| 現在 | 許可する次状態 | 保存ルール |
|---|---|---|
| 作成 | `todo` | `doneAt = null` |
| `todo` | `doing`、`done`、`cancelled` | `done`の場合だけ`doneAt`を現在時刻にする |
| `doing` | `todo`、`done`、`cancelled` | `done`の場合だけ`doneAt`を現在時刻にする |
| `done` | `todo` | 再開時は`doneAt = null` |
| `cancelled` | `todo` | 再作成ではなく再開として扱い、`doneAt = null` |

`done` と `cancelled` から直接 `doing` へは遷移させない。`doneAt` は `status = done` のときだけ非nullにし、それ以外ではnullにする。無効な遷移は409で拒否する。

## API案

G07ではTask専用APIを追加する。既存のLead更新APIへTask項目を混ぜない。

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/leads/{leadId}/tasks?scope=active\|all` | Leadの次回対応一覧・履歴 |
| POST | `/api/leads/{leadId}/tasks` | 次回対応を作成 |
| PATCH | `/api/tasks/{taskId}` | 内容、日時、担当、状態を更新 |
| GET | `/api/task-assignees` | `isActive = true` の担当候補を取得 |

### 作成・更新項目

```ts
type CreateTaskInput = {
  title: string;
  description?: string;
  dueAt?: string;       // ISO 8601、offset付き
  assigneeId?: string;  // User UUID
};

type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  assigneeId?: string | null;
  status?: 'todo' | 'doing' | 'done' | 'cancelled';
};
```

APIは共通の `{ data, meta, error }` wrapperを使う。`doneAt` はクライアントから受け取らず、status遷移からserver側で決める。

### 検証とエラー

- `leadId`、`taskId`、`assigneeId` はUUIDとして検証する。
- `title` は必須、空文字を拒否する。表示上限は120文字にする。
- `description` は任意。保存上限を設け、一覧では全文を返さない。
- `dueAt` はISO 8601のoffset付き日時を受け付け、DBにはUTCで保存する。
- `assigneeId` は存在し、`isActive = true` のUserだけ許可する。
- 終端Lead（`rejected`、`archived`）への新規Task作成は拒否する。
- 対象Leadが存在しない場合は404、対象TaskがLeadに属さない場合も404とする。
- 状態遷移の規則違反は409にする。

## DB変更の判断

### G06/G07で変更しないもの

`Task` は初期migrationで既に次の構造を持つ。

- `leadId` と `SalesLead` relation
- `assigneeId` と `User` relation
- `title`、`description`
- `status`、`dueAt`、`doneAt`
- `createdAt`、`updatedAt`
- `status/dueAt`、`leadId`、`assigneeId` のindex

そのため、G07ではschema変更・migration追加を行わず、domain、application、repository、controller、DTO、API docsを追加する。

### 将来の候補

Task件数が増え、Leadごとの未完了Task検索が遅くなった場合だけ、`(leadId, status, dueAt)` の複合indexを追加候補にする。G06で先にmigrationを作らない。

## 既存Leadとの互換方針

既存の `nextActionAt` / `nextFollowUpAt` をいきなりTaskへ移行すると、手入力値の出所が分からず消失する可能性がある。G07/G08では次の優先順にする。

1. 未完了Taskの `nextTask.dueAt`
2. 既存 `nextActionAt`
3. 既存 `nextFollowUpAt`

Taskが存在しないLeadは従来表示を維持する。Task完了時に既存Lead日時を無条件でnullへ上書きしない。これにより、旧画面から保存された予定を壊さず、Task導入後の予定だけを優先表示できる。

今日の営業の期限判定は、この優先順で得た日時を `classifyTodaySales()` へ渡す。日付比較は既存の `tokyoDateKey()` を使い、保存はUTC、表示・期限判定は `Asia/Tokyo` とする。

## G07/G08の実装境界

### G07 backend

- `Task` のdomain policyと状態遷移を純粋関数にする。
- Task repositoryとUseCaseを追加する。
- Lead一覧/詳細へ `nextTask` と `activeTaskCount` を追加する。
- Task APIと担当候補APIを追加する。
- `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- `nextActionAt` の旧値を破壊しない。

### G08 UI

- 返信対応または営業案件詳細に次回対応の入力欄を追加する。
- 日時、対応内容、担当、状態を保存・表示する。
- 保存中、成功、失敗を別表示にする。
- 成功後に対象Leadと今日の営業の表示を再取得する。
- 期限超過・今日・未来・日付未定を `Asia/Tokyo` で表示する。

## G06の受け入れ結果

- 必要なdata項目をTaskとLead summaryに分けて固定した。
- Taskの状態遷移と`doneAt`の不変条件を固定した。
- API案とエラー方針を固定した。
- DB変更不要と判断した。
- UTC保存、`Asia/Tokyo`表示、期限超過判定を固定した。
- 既存Lead updateをTask保存へ流用しない範囲を固定した。

## G07実装結果

- `domain/task.ts` と `domain/task-policy.ts` にTask表示型、未完了判定、Lead終端判定、状態遷移を追加した。
- `PrismaTaskRepository` を `TASK_REPOSITORY` port経由でUseCaseへ接続した。
- `GET/POST /api/leads/{leadId}/tasks`、`PATCH /api/tasks/{taskId}`、`GET /api/task-assignees` を追加した。
- `GET /api/leads` と `GET /api/leads/{id}` に `nextTask` と `activeTaskCount` を追加した。
- UUID、title、担当者、終端Lead、状態遷移をAPIで検証する。
- schema/migrationは変更していない。

## G08実装結果

- 営業案件詳細に `data-ui="lead-task-workspace"` を追加した。
- 次回対応の作成・編集、日時、担当、補足、未着手/対応中/完了/取消/再開をUIから操作できる。
- 保存中、成功、失敗を `taskWorkspaceStatus` で表示する。
- 保存後はLeadとTaskを再取得し、`nextTask` と今日の営業の期限表示へ反映する。
- Task日時の入力・表示、今日の営業の期限表示は `Asia/Tokyo` を基準にした。
