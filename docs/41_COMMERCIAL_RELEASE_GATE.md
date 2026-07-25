# 商用リリース判定

## 判定原則

一般販売は、次の全項目に証跡がある場合だけ `GO` とする。未確認項目を「後で対応」として販売開始しない。

## 技術ゲート

- `npm ci`、`npm audit --audit-level=high`、`npm run verify`、`npm run test:integration` が成功する。
- 空DBと既存DBの両方へrelease用migration imageを適用し、`/ready` が200になる。
- 同じGit SHAからmigration、API、database-ops imageを作り、改変不能なSHA tagでregistryへ保存する。
- stagingでログイン、案件登録、分析、下書き、レビュー、承認、配信停止、バックアップ、復元を確認する。
- 実送信を使う場合は専用テスト宛先で1通だけ送信し、送信者表示、`List-Unsubscribe`、本文の配信停止URL、Gmail message IDを確認する。
- セキュリティ製品のURL scannerで、クリック数や商談状態が誤更新されないことを確認する。

## 契約・法務ゲート

- `/privacy` と `/terms` の運営者名、所在地、問い合わせ先、施行日を実在情報で設定する。
- 個人情報の利用目的、委託先、国外移転、保存期間、開示・削除窓口を担当者または弁護士が確認する。
- 広告・営業メールの送信根拠、対象リストの取得元、表示義務、配信停止運用を法務担当が承認する。
- CAMPFIRE、Makuake等の取得対象について、利用規約・robots.txt・権利者許諾・取得頻度を記録する。
- 申込書に料金、利用上限、支払日、契約期間、更新、解約、責任上限、データ返却・削除を記載する。
- Google OAuth同意画面、ブランド情報、プライバシーポリシー、利用ドメイン、必要scopeの審査を完了する。

## 運用ゲート

- 障害連絡先、一次応答時間、重大度、顧客通知方法、営業時間を決める。
- 日次暗号化backupが別accountへ保存され、過去1か月以内に隔離DBへの復元演習が成功している。
- 退職者無効化、権限棚卸し、秘密鍵rotation、脆弱性対応、監査ログ確認の担当者を決める。
- productionの監視で、`/ready`、5xx、送信失敗、配信停止失敗、backup失敗を通知する。

## 実行

秘密情報をリポジトリ外のenv fileへ用意し、一般販売前に次を実行する。

```bash
npm run release:check -- --env-file /secure/path/production.env
```

メール送信を無効化した限定パイロットでは、契約書にその制限を明記したうえで次を使える。

```bash
npm run release:check -- --env-file /secure/path/production.env --allow-mail-disabled
```
