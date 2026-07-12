# mail module

## 役割
営業メールの下書き、レビュー、承認、却下、送信待ち、送信済み、返信記録を管理する。
営業メール、サイトDM、問い合わせフォーム用の定型文テンプレートも管理する。

## 触ってよい場所
- API変更: `mail.controller.ts` / `mail.dto.ts`
- 業務操作: `application/*.usecase.ts`
- 状態遷移・禁止ルール: `domain/mail-policy.ts`
- 返信一覧表示変換: `domain/reply-inbox.ts`
- 返信一覧query: `infrastructure/prisma-reply-inbox.repository.ts`
- 実送信provider契約: `domain/mail-sender.ts`
- DB保存・イベント作成: `infrastructure/prisma-mail-workflow.repository.ts`
- 実送信provider実装: `infrastructure/*mail.sender.ts`
- チェックリスト初期値: `mail-checklist.defaults.ts`
- 定型文テンプレート: `MailTemplate` / `/mails/templates`

## 重要ルール
- `approved` 以外は `queue` 不可
- checklist 未完了なら `approve` / `queue` 不可
- `rejected` だけ再レビュー可能
- AI生成メールは自動送信しない
- 同じ lead に重複メールを作らない
- 実送信は `queued` かつ checklist 完了のみ
- providerの`validate`をclaim前に実行し、非対応チャネルでは送信中状態へ進めない
- 実送信前に `queued` のメールだけを条件付きで `sending` にclaimし、二重送信を防ぐ
- provider失敗時は `failed` にする
- provider未設定時は `DisabledMailSender` が失敗させるため、誤送信しない
- `MAIL_SEND_ENABLED=true` で明示しない限り、provider指定があっても実送信しない
- 送信providerには `sendMethod` とサイトURLを渡し、Gmail providerは `email` / `メール` 以外を拒否する
- Gmail providerを追加する場合は `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` / `GMAIL_FROM_EMAIL` が必須
- 会社資料リンクは `tracking` moduleで `company_material` として追跡し、leadのアポ角度に反映する
- 定型文は `key` で上書き保存する。同じ `key` の取り込みは新規追加ではなく修正保存として扱う

## AI向け注意
承認・却下・送信待ちなどの条件変更は、まず `domain/mail-policy.ts` を見る。DB更新やイベント追加だけを変える場合は `infrastructure` を見る。
実送信を追加する場合は、`domain/mail-sender.ts` の `MailSender` 契約に合わせたproviderを `infrastructure/` に追加し、`infrastructure/mail-sender.config.ts` で `MAIL_SENDER` のprovider差し替えだけで接続する。
サイト内メッセージと問い合わせフォームの実送信は、対象サイトの認証・CSRF・入力仕様に合わせた専用providerが必要であり、Gmail providerへフォールバックさせない。
Gmailの認証設定は `infrastructure/gmail-mail-sender.config.ts` を見る。
資料閲覧による営業温度感は `tracking/domain/material-engagement-policy.ts` と `tracking/tracking.service.ts` を見る。
定型文の取り込み・編集保存は `MailService.saveTemplate` / `MailService.importTemplates` を見る。メール用だけでなく `site_message` や `contact_form` 用の文面も同じテンプレート管理で扱う。
Reply Inboxの分類表示、優先度、安全フラグは `domain/reply-inbox.ts` の純粋関数で変換する。DB queryはG03のrepositoryに置く。
Reply InboxのPrisma条件・pagination・sortを変える場合は `infrastructure/prisma-reply-inbox.repository.ts` とそのspecを確認する。ControllerやHTMLにquery条件を追加しない。
G04でAPIへ接続するときは `domain/reply-inbox.repository.ts` のquery/result型をUseCaseのportとして再利用する。
