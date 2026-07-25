# Gmail・Google OAuth公開前チェック

- Google Cloud projectの所有組織、support email、developer contactを実在情報にする。
- OAuth consent screenに公開ドメイン、`/privacy`、`/terms`を登録する。
- 利用者ログイン用OAuth clientとGmail送信用credentialを分離する。
- Gmailは送信に必要な最小scopeだけを申請し、不要なread/modify scopeを要求しない。
- 審査提出用動画で、ログイン、scope説明、承認、送信、配信停止を再現する。
- productionのredirect URIとJavaScript originを完全一致させる。
- 審査完了前はテストユーザーだけに限定し、一般顧客へ「未確認アプリ」を使わせない。
- refresh tokenをsecret managerで保管し、ログ、DB、backup、エラー本文へ出さない。
- credential失効時の停止、再認証、顧客通知手順を確認する。
- 専用テスト宛先で送信し、From、Message-ID、List-Unsubscribe、配信停止POSTを確認する。
