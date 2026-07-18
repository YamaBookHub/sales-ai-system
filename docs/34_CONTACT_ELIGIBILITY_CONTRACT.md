# 34_CONTACT_ELIGIBILITY_CONTRACT

## 目的

`SO-003` の正本として、送信禁止企業、配信停止済み連絡先、同一送信先への重複接触を、メール作成から送信記録まで同じ判定で拒否する。

## 共通判定

次の順で判定し、拒否理由を `ConflictException` として返す。

1. `Company.isBlocked` がtrue
2. 選択連絡先がアーカイブ済み
3. 選択連絡先が配信停止済み
4. 下書き保存時のメールアドレスと連絡先の現在値が不一致
5. 登録済み連絡先がすべて配信停止
6. 同じ正規化送信先に作業中または送信済みの別メールが存在

拒否時は `OutreachEmail`、`SalesLead`、`AiGeneration`、`EmailEvent` を更新しない。

## 送信先キー

重複判定は会社名や案件名ではなく、`送信手段 + 正規化した送信先` で行う。

| 手段 | 例 |
|---|---|
| メール | `email:contact@example.com` |
| 問い合わせフォーム | `contact_form:https://example.com/contact` |
| サイト内メッセージ | `site_message:https://example.com/profile/123` |

- メールは前後空白を除去し、小文字化する。
- URLはhostを小文字化し、hashと末尾slashを除去する。
- query parameterは送信先を識別する可能性があるため保持する。
- `draft`、`in_review`、`approved`、`queued`、`sending`、`sent` を重複対象にする。
- `failed`、`rejected`、`cancelled` は、`sentAt` がない限り重複対象にしない。
- 操作中のメール自身は重複対象から除外する。

## 履歴保存

新規下書きには次を保存する。

- `destinationType`: `email` / `contact_form` / `site_message`
- `destinationValue`: 正規化済み送信先
- `destinationKey`: 手段を含む比較キー

既存メールは、保存済みの `toEmail`、連絡先、Leadの送信先から互換判定する。後続のレビュー・承認・送信待ち・手動送信記録時に送信先スナップショットを補完する。

## 排他

- 下書き作成はLead単位のadvisory lockを取得し、ロック後に既存メールを再確認する。
- 送信先キー単位のadvisory lockを取得し、重複履歴の確認と作成・状態遷移を同じtransactionで行う。
- 複数キーを扱う場合は辞書順にlockし、deadlockを避ける。
- 同じ状態への二重遷移は拒否し、同じ手動送信イベントを複数作らない。

## 適用入口

- AI下書き生成
- 手入力下書き生成
- レビュー依頼・再レビュー
- 承認・送信待ち・retry
- 手動送信記録
- 実送信claimとprovider呼び出し直前

## 合格条件

1. 会社block、配信停止、無効連絡先、宛先変更を後続操作で再検知する。
2. メールとURLの表記差を正規化し、同じ送信先への重複を拒否する。
3. 拒否時にメール、Lead、AI履歴、イベントを進めない。
4. 同時操作でも下書き・手動送信記録を重複作成しない。
5. 新規メールの送信先スナップショットが後から編集される会社・Lead情報に影響されない。
