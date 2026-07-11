# 22_AI_MODEL_ROUTING

## 目的

この文書は、Codexが作業内容に応じて自律的にモデルを選び、使用量を抑えながら安全に実装するための指示書である。

モデルの性能を常に最大にするのではなく、変更範囲を小さくしたうえで必要十分なモデルを使う。高性能モデルは設計判断、危険な変更、監査に集中させ、明確になった実装は低コストモデルへ渡す。

## 基本ルール

1. コード変更の下限は、原則として `GPT-5.4 mini` 相当とする。
2. 日常の小さな実装は `GPT-5.6 Luna` 相当を標準とする。
3. 複数責務を分ける変更は `GPT-5.6 Terra` 相当を使う。
4. 設計判断、重大な安全性、原因不明の障害は `GPT-5.6 Sol` または `GPT-5.5` 相当を使う。
5. モデル名が利用できない場合は、名称ではなく後述の役割に最も近いモデルを選ぶ。
6. モデル変更やモデル指定が実行環境で可能なら、ユーザーへ毎回確認せず自律的に行ってよい。
7. 現在のエージェント自身を切り替えられない場合は、適切なモデルのサブエージェントへ境界の明確な作業を委譲してよい。
8. モデルを下げる代わりに、一度の変更範囲を小さくし、受け入れ条件とテストを明確にする。

## モデル役割

| 役割 | 現在の目安 | 推論設定 | 任せる作業 |
|---|---|---|---|
| Architect | GPT-5.6 Sol / GPT-5.5 | high以上 | 設計、境界決定、難しい障害、最終監査 |
| Senior Implementer | GPT-5.6 Terra | medium以上 | 複数ファイルの機能実装、段階的リファクタリング |
| Default Implementer | GPT-5.6 Luna | medium以上 | 1module内の実装、テスト、明確なUI変更 |
| Bounded Worker | GPT-5.4 mini | high推奨 | 1目的・少数ファイルの変更、機械的分離、文書更新 |

`nano` 相当はコード変更には使わない。利用する場合も、誤字修正、表示文言、形式変換など、テスト不要で意味が変わらない作業だけに限定する。

## 作業開始時の選択手順

エージェントは作業開始前に次を内部で判定する。

1. 変更対象は1module以内か。
2. API、DB、domain、認証、実送信、外部サイト取得に影響するか。
3. 既存の受け入れ条件とテストがあるか。
4. 変更後の正しさを自動テストで判定できるか。
5. 既存ファイルが巨大、または責務が混在しているか。

次の基準で開始モデルを選ぶ。

- 1目的、1module、受け入れ条件あり、テストで判定可能: Bounded Worker
- 1module内だが複数ファイル、既存パターンに沿う実装: Default Implementer
- 複数責務の分離、5ファイル以上、巨大ファイルの段階分割: Senior Implementer
- module境界変更、DB設計、送信安全性、認証、横断設計: Architect

## 自動昇格条件

次のどれかに該当したら、現在のモデルで試行を続けず、1段階上のモデルへ切り替える。

- 変更対象が予想外に5ファイルを超えた。
- API、DB schema、domainの重要ルールも変更する必要が判明した。
- 既存テストが失敗しており、変更との因果関係を説明できない。
- 同じ原因に対して2回修正してもテストが通らない。
- 巨大ファイル内で責務の境界を決める必要がある。
- メール実送信、認証情報、外部公開、データ削除が関係する。
- ユーザーの既存変更と競合し、安全な統合方法を判断できない。
- 正しさを確認するテストまたは受け入れ条件を定義できない。

昇格時は、失敗した修正をむやみに重ねない。変更状況、失敗内容、守る条件を上位モデルへ渡す。

## 自動降格条件

ArchitectまたはSenior Implementerが次を確定した後は、実装をDefault ImplementerまたはBounded Workerへ渡してよい。

- 変更対象ファイルが明確である。
- 変更してはいけないAPI、DOM ID、状態遷移が列挙されている。
- 1回の作業が1目的に分割されている。
- 合格条件となるテストまたは確認手順がある。
- 失敗時の切り戻しではなく、修正範囲の特定方法がある。

## このリポジトリでの具体例

| 作業 | 推奨役割 |
|---|---|
| `dashboard.controller.ts` の現状固定テスト追加 | Bounded Worker |
| 1画面分のHTMLまたはCSSを挙動不変で分離 | Default Implementer |
| dashboardのstate / render / actions境界を決める | Senior Implementer |
| dashboard分割全体の設計と完了監査 | Architect |
| 既存usecaseの単体テスト追加 | Bounded Worker |
| 1module内の既存パターンに沿った機能追加 | Default Implementer |
| Prisma schema変更とmigration追加 | Senior Implementer |
| メール実送信、認証、二重送信防止の変更 | Architect |
| CAMPFIREまたはMakuakeのHTML抽出修正 | Default Implementer |
| scraperのbrowser / parser / mapper境界設計 | Senior Implementer |
| 文言、README、進捗表の更新 | Bounded Worker |

## dashboard分割中の特別ルール

`apps/api/src/dashboard/dashboard.controller.ts` の分割が終わるまでは、UI作業を低モデルへ一括依頼しない。

- 1回に1画面または1責務だけ変更する。
- `/`、`/leads-view`、`/mail-workspace` を変えない。
- 既存API、DOM ID、主要class、画面文言を同時に変えない。
- React、Vueなどのフレームワーク移行を同時に行わない。
- HTML分離、CSS分離、JavaScript分離を別タスクにする。
- 各段階でdashboardの回帰テスト、全テスト、buildを通す。
- 画面設計の変更は `docs/20_UIUX_AI_IMPLEMENTATION_GUIDE.md`、進捗は `docs/21_UIUX_IMPLEMENTATION_STATUS.md` に従う。

## サブエージェントへ渡す必須情報

低モデルまたは別エージェントへ委譲するときは、最低限次を含める。

```text
目的:
変更対象:
変更してはいけないもの:
受け入れ条件:
実行するテスト:
作業範囲外:
既存変更を削除・巻き戻ししないこと:
```

「設計を改善して」「全部分割して」のような広い指示は禁止する。

## 検証ルール

コード変更後は原則として次を実行する。

```bash
npm run build
npm test -- --runInBand
```

Prisma schemaを変更した場合は次も実行する。

```bash
npm run prisma:validate
npm run prisma:generate
```

UI変更は、可能なら対象画面をブラウザで開き、コンソールエラー、表示崩れ、主要操作を確認する。

## 高モデルによる監査のタイミング

毎回高モデルを使う必要はない。次の節目だけArchitectが確認する。

- dashboardのHTML分離完了時
- CSS / JavaScript分離完了時
- 新しいDB migrationを適用する前
- メール実送信を有効にする前
- 外部サイト取得方法を大きく変更した時
- 1つの機能が複数moduleにまたがった時

監査後の小さな修正は、再びDefault ImplementerまたはBounded Workerへ戻す。

## 現在の推奨運用

- 通常運用: GPT-5.6 Luna相当
- 小さく明確な変更: GPT-5.4 mini相当
- dashboard段階分割: GPT-5.6 Terra相当
- 設計確定、危険な変更、難しい障害: GPT-5.6 SolまたはGPT-5.5相当

モデル情報は変わるため、名称より役割を優先する。公式モデル一覧で後継モデルが推奨された場合は、同じ役割の後継へ置き換える。

参考: https://developers.openai.com/api/docs/models
