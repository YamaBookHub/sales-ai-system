# COMPLETENESS_REPORT

## 目的

この文書は、実装済み・部分実装・未実装を2026-07-13時点のコードで固定する現状報告である。

- 対象commit: `6a04a5a`
- 通常テスト: 59 suites / 166 tests 成功
- build: 成功
- Prisma validate: 成功
- 実DB統合テスト: `TEST_DATABASE_URL` 未設定のため1 suite skip
- 実ブラウザ確認: 今回は未実施

仕様書とコードが矛盾する場合、未解消の矛盾を隠さない。実装変更時は `docs/27_LUNA_EXECUTION_GUIDE.md` と `docs/28_REMAINING_WORK_STATUS.md` を使って1件ずつ解消する。

## 現在使える機能

| 領域 | 状態 | 実装済み |
|---|---|---|
| 候補検索 | 部分完了 | CAMPFIRE / Makuake検索、検索ジョブ、進捗取得、停止API、重複URL除外 |
| 案件取り込み | 部分完了 | 単体・一括取り込み、Company / Project / Lead保存、監査ログ、任意のローカル分析 |
| 営業案件 | 利用可能 | 一覧、詳細、編集、分析履歴、次回対応Task、CSV / TSV出力 |
| メール下書き | 利用可能 | ローカル下書き、OpenAI整形、下書き履歴、本文編集、整合性警告 |
| レビュー | 利用可能 | 保存、レビュー依頼、棄却、再レビュー、承認、送信待ち |
| 送信前安全 | 部分完了 | checklist、状態遷移、二重claim防止、provider無効時の送信拒否 |
| 返信対応 | 部分完了 | 返信一覧、分類表示、次回対応Task、手動返信登録 |
| Gmail送信 | 部分完了・既定OFF | OAuth provider、明示的有効化、短期retry、手動復旧 |
| UI/UXロードマップ | 完了 | `UX-A01` から `UX-I08` まで実装済み |

## まだ足りないもの

### P0: 正しさを判断する土台

1. `docs/06_API.md` と `openapi/openapi.yaml` が現行routeを網羅していない。
2. `docs/07_DATABASE.md` のenumと現行Prisma schemaが一致していない。
3. `docs/17_IMPLEMENTATION_ROADMAP.md` の現在地が古い。
4. UI進捗表の一部証跡が `uncommitted` のままで、現行HEADと結び付いていない。
5. 実DB統合テストは基盤のみで、現環境では未実行。
6. ブラウザE2Eを自動実行する仕組みがない。

### P0: メール品質

1. `POST /api/mails/draft` の互換経路には、入力がない場合の `TODO` 本文が残っている。
2. 実案件を固定したgolden testがなく、米びつ、サーモン、醤油差し、ライブ、店舗改装などの案件間混入を継続検知できない。
3. OpenAI整形入力で、案件説明以外の古い分析メモが現在案件と一致するかを十分に検証していない。
4. 【商品の魅力】【使う人】【見せ方】を人が確認・修正してからメール生成する構造化された正本がない。
5. OpenAI利用履歴は保存されるが、月額上限や実行前警告の一元管理がない。

### P0: 取得精度と検索ジョブ

1. CAMPFIRE / MakuakeのHTML fixture testがなく、サイトDOM変更を自動検知できない。
2. 検索停止APIは現在の検索ループを停止状態にするが、実行中のPlaywright処理を即時中断しない。
3. 検索結果はprovider呼び出し単位で増えるため、1件取得するたびの逐次反映ではない。
4. 指定件数未満で終わった理由を、`条件一致不足`、`既存URL除外`、`取得元終了`、`停止` に分けて返していない。
5. 検索ジョブはプロセスメモリ内にあり、再起動・複数API instance・複数ユーザーに耐えない。
6. provider単位のparser境界が弱く、外部HTML修正時の変更範囲が大きい。

### P1: 営業案件を本格運用するための不足

1. 営業案件画面は最大200件を取得してclient側でページングするため、200件を超える全件一覧・全件出力にならない。
2. source、status、priority、連絡先、次回対応のfilter/sortをAPI側で統一していない。
3. ContactPersonの業務用CRUDが不足している。
4. 重要操作のAuditLogが全routeで統一されていない。
5. blocked company / unsubscribed contactを実送信直前に共通拒否する境界が未完成。

### P1: 複数人・本番運用の不足

1. `User` とroleはDBにあるが、ログイン、現在ユーザー、認証guardがない。
2. OpenAPIはBearer認証を前提にするが、実装で強制されていない。
3. managerだけが承認・queueできるRBACが未実装。
4. 検索ジョブ、取り込み、分析、承認の所有者・操作主体を信頼できる認証情報から取得していない。
5. CI、production Dockerfile、Redis、worker、scheduler、DLQ、構造化監視は未実装。

### P2以降: 拡張機能

- GREEN FUNDING provider
- 会社サイト・SNS・連絡先の自動探索
- 参考メールRAG
- Gmail返信自動同期
- site message / contact formの外部送信provider
- 面談、提案、見積、契約、請求、キックオフ管理
- Google Calendar、スケジュール通知、ポモドーロ支援

## 現在の優先順位

1. 仕様と実装を同期し、Lunaが誤った正本を読まない状態にする。
2. メールの案件間混入をgolden testで止める。
3. CAMPFIRE / Makuake抽出をfixture testで固定する。
4. 検索ジョブの不足理由・即時停止・逐次追加を完成させる。
5. 営業案件のserver paginationと本当の全件出力を完成させる。
6. その後に認証、RBAC、監査、複数instance対応へ進む。

メール実送信、返信自動同期、送信後CRMは当面の最優先にしない。既存の安全境界を維持し、明示的な別タスクまで実送信を有効にしない。
