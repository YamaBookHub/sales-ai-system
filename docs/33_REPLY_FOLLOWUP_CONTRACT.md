# 33_REPLY_FOLLOWUP_CONTRACT

## 目的

手動で記録した返信について、返信分類、営業案件の状態、次回対応日、Task、配信停止を一つのtransactionで更新する。
Gmailからの自動同期は本契約に含めない。

## 登録API

- `POST /api/mails/{id}/replies`
- 入力: `body`、任意の`fromEmail`、任意の`receivedAt`
- `receivedAt`未指定時は登録時刻を利用する。
- 分類とTask期限は登録時刻ではなく`receivedAt`を基準にする。

## 原子更新

次の処理は同じDB transaction内で行う。途中で一つでも失敗した場合は全て取り消す。

1. 対象メールを確認する。
2. `EmailReply`を作成する。
3. `SalesLead.status`と`nextActionAt`を更新する。
4. 対応が必要な分類では`Task`を作成する。
5. `EmailEvent(replied)`へ分類、期限、Task IDを記録する。
6. 配信停止では`ContactPerson.isUnsubscribed`を永続化する。

## 分類と次回対応

| 分類 | 表示 | Lead状態 | Task期限 |
|---|---|---|---|
| `interested` | 興味あり | `replied` | 受信日当日 |
| `need_info` | 資料・詳細希望 | `replied` | 受信日の翌日 |
| `meeting_request` | 商談希望 | `meeting_candidate` | 受信日当日 |
| `not_interested` | 見送り | `no_response` | 作成しない |
| `unsubscribe` | 配信停止 | `rejected` | 作成しない |
| `auto_reply` | 自動返信 | `contacted` | 受信日の3日後 |
| `complaint` | クレーム | `replied` | 受信日当日 |
| `unknown` | 要確認 | `replied` | 受信日当日 |

見送りと配信停止では`nextActionAt`と`nextFollowUpAt`を消去する。配信停止はメールに紐づく連絡先を優先し、未紐付けの場合は同じ会社の返信元メールアドレスを照合する。

## 重複防止

- メールID、返信元、本文が同じ返信の登録をDB advisory lockで直列化する。
- 5分以内に同じ内容が登録済みの場合は409で拒否する。
- この判定により、二重クリックや同時リクエストでTaskが重複しない。

## 表示

- `/replies`: 8分類、本文要約、次の対応、Task名、Task期限、今日が期限、期限超過を表示する。
- `/today`: `GET /api/leads/today`を使い、期限超過、今日、下書き、承認待ち、送信待ち、返信あり、送信失敗をサーバー側で分類する。
- `/today`は50件単位でページングし、従来の200件取得・20件表示による取りこぼしを行わない。

## 検証

- 8分類の単体テスト
- 返信、Lead、Task、返信一覧の整合性を専用test DBで確認
- 配信停止のContact永続化を専用test DBで確認
- 同一返信の再登録拒否とTask非重複を専用test DBで確認

