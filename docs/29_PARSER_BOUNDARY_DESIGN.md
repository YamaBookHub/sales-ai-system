# 29_PARSER_BOUNDARY_DESIGN.md - 取得とHTML parserの境界設計

## 目的

ブラウザ操作、HTMLからの値の抽出、アプリケーションで使う値への正規化を分離し、CAMPFIRE と Makuake の取得精度を sanitized fixture で再現可能に検証する。

この文書は LS-001 の設計正本である。ここでは既存の取得挙動を変更しない。LS-002 と LS-003 で、この境界に沿った parser と fixture test を追加する。

## 境界

```text
browser acquisition -> raw page snapshot -> provider parser -> normalized provider result
```

| 層 | 責務 | 禁止事項 |
|---|---|---|
| browser acquisition | Playwright の起動、URL遷移、待機、ページ内容・表示テキストの取得、ページ終了 | CSS selector で事業値を解釈しない。`amount` や `daysLeft` を数値化しない。 |
| provider parser | HTML/表示テキストから provider 固有の項目を抽出し、採用した fallback を記録する | Browser、Page、待機、ネットワーク、DB に依存しない。 |
| normalizer / mapper | provider 固有の抽出結果を `CampfireSearchResult` と `NormalizedImportedProject` に変換し、URL・数値・status を正規化する | HTML selector やページ本文を直接読む。 |
| service / use case | 検索条件、重複除外、並び替え、保存、ジョブ状態を扱う | HTML の構造に依存する。 |

`CampfireScraperService` は現状、browser acquisition と provider parser を同居させている。LS-003 では同サービスを呼出し口として維持しつつ、純粋な parser を分離する。`MakuakeProjectSourceProvider` も同様に、browser操作を acquisition、`extractProject` 等を parser として切り出す。

## 入出力契約

### Raw page snapshot

browser acquisition から parser へ渡す値は、ページ種別ごとに次の最小契約とする。fixture はこの契約をそのまま再現する。

```ts
type PageKind = 'listing' | 'detail' | 'profile';

type RawPageSnapshot = {
  source: 'campfire' | 'makuake';
  kind: PageKind;
  url: string;
  html: string;
  visibleText?: string;
};
```

- `html` は parser の主入力であり、取得時点の DOM を保持する。
- `visibleText` は SPA や埋め込みデータに値がない場合だけ使う補助入力である。
- 取得日時、HTTP 応答、Browser/Page は parser 契約に含めない。運用ログが必要になった場合も acquisition 側の観測情報として別に保持する。

### Parser result

parser は provider 固有の未正規化値を返す。金額・支援者数・日数の文字列をこの段階で勝手に補完せず、見つからない値は `null` または空文字を明示する。

```ts
type ParserResult<T> = {
  value: T;
  fallbacksUsed: string[];
};
```

- `fallbacksUsed` は primary selector 以外を採用した時に selector 名または抽出経路名を順番に記録する。test では値を主対象とし、fallback を使うケースでは経路も固定する。
- parser が返す `T` は `CampfireListingItem`、`CampfireDetail`、`CampfireProfile`、`MakuakeListingItem`、`MakuakeDetail`、`MakuakeProfile` のようにページ種別を混ぜない provider 固有型とする。
- `NormalizedImportedProject` と `CampfireSearchResult` は mapper の出力であり、parser の直接の返却型にしない。

### Normalization

normalizer / mapper が行う処理は次に限定する。

- `1,234円`、`1,234人`、`残り8日` のような抽出済み文字列を数値へ変換する。
- `募集中`、`終了`、`もうすぐ公開` など provider 表現を検索用の `isActive` と保存用の project status に変換する。
- 相対URLを絶対URLにし、空文字を `undefined` または `null` に変換する。
- `CampfireProjectSourceProvider` の import 用 `raw` には、デバッグ可能な provider 固有の抽出値を残す。

正規化前の生文字列と正規化後の数値を同一フィールドへ混在させない。`daysLeft` のように値が取れない場合は `0` と「不明」を同一視せず、parser では `null`、既存契約で必要な既定値は mapper でのみ適用する。

## ページ種別ごとの責務

| 種別 | acquisition | parser | normalizer / mapper |
|---|---|---|---|
| listing | 検索URLを開き、一覧の HTML と必要時の表示テキストを取得する | カード単位で title、URL、金額、支援者数、カテゴリ、残り日数、公開状態を抽出する | 検索条件用の数値・`isActive` を作る。重複除外、filter、sort、limit は service 側に渡す。 |
| detail | 案件URLを開き、案件ページの snapshot を取得する | 案件名、実行者、ブランド、支援額、支援者、達成率、説明、カテゴリ、外部URL、profile URL を抽出する | `NormalizedImportedProject.project`、company/lead の候補値へ写像する。 |
| profile | 実行者profile URLを開き、profile snapshot を取得する | 実行者名、過去プロジェクト件数、必要な集計値を抽出する | profile件数の条件判定と company の source metrics へ写像する。 |

listing parser は profile を開かない。profile enrichment が必要な場合、service が profile acquisition と profile parser を明示的に呼ぶ。detail parser も profile の件数を推測しない。

## Selector fallback 方針

1. provider ごと・項目ごとに、意味の強い selector / 埋め込み構造化データを primary とする。
2. primary がない場合だけ、同じページ種別に限定した順序付き fallback を試す。
3. 最後の fallback は `visibleText` のラベル近傍抽出とする。ページ全体の数字列から金額・日数を推測しない。
4. 別項目の数値を再利用しない。特に金額、支援者数、残り日数は独立して抽出し、`残り8日` と `150日` のような隣接値を結合しない。
5. すべて失敗した場合は欠損として返し、active 判定や保存値の補完は mapper / policy が明示的に行う。

selector 名は parser 内で定数化し、`fallbacksUsed` と test 名で同じ名称を使う。サイト変更時は fixture を追加してから selector を変更する。

## Fixture 方針

fixture は live site に依存しない。実ページを保存する場合は、個人情報、問い合わせ先、追跡パラメータ、不要な画像・script を除去した sanitized HTML とする。

```text
apps/api/src/projects/infrastructure/parsers/
  campfire/
    campfire-listing.parser.ts
    campfire-detail.parser.ts
    campfire-profile.parser.ts
    __fixtures__/
      listing-active.html
      listing-ended.html
      detail-active.html
      profile-100-plus.html
  makuake/
    makuake-listing.parser.ts
    makuake-detail.parser.ts
    makuake-profile.parser.ts
    __fixtures__/
      listing-current.html
      listing-selling.html
      detail-comma-amount.html
      profile-six-projects.html
```

- fixture 名は provider、ページ種別、検証する状態を示す。URLや取得日時をファイル名に含めない。
- 必要なら同名の `.json` expectation を置くが、期待値が短い場合は spec 内に記述してよい。
- fixture は最小の再現DOMに縮小してよい。ただし selector の実際の階層と、fallback が必要になった表示テキストは残す。
- `html` と `visibleText` の両方が必要な例では、spec が `RawPageSnapshot` を明示的に組み立てる。fixture ローダーが Browser を起動してはならない。
- 実URL、個人名、メールアドレス、電話番号、認証情報、cookie、分析IDは fixture に含めない。

LS-002 は Makuake の金額、支援者、残り日数、カテゴリ、地域、実行者、profile 6件を固定する。LS-003 は CAMPFIRE の募集中、終了、公開前、初回、100件以上を固定し、active だけを候補化することを検証する。

## 将来の変更単位

LS-001 の時点では文書のみを変更する。以降の実装では、次の単位を混在させない。

| 作業 | 変更対象 |
|---|---|
| 共通契約 | `apps/api/src/projects/infrastructure/parsers/parser.types.ts` を追加し、`RawPageSnapshot`、`ParserResult`、ページ種別を置く。 |
| Makuake parser / test | `makuake-project-source.provider.ts` から純粋抽出を `parsers/makuake/` へ移し、Makuake fixture と spec だけを追加する。browser acquisition、provider の公開契約、DBは変更しない。 |
| CAMPFIRE parser / test | `scraper/campfire-scraper.service.ts` から純粋抽出を `parsers/campfire/` へ移し、CAMPFIRE fixture と spec を追加する。`CampfireProjectSourceProvider` は mapper として既存の import 契約を保つ。 |
| 検索終了理由以降 | parser が確定した検索結果を入力として扱い、HTML selector や fixture を変更しない。 |

parser の移設は一度に provider を統合しない。各 provider で fixture test を先に追加し、既存の public method、DTO、OpenAPI、Prisma schema を変えずに抽出の呼出し先だけを差し替える。

## 受入条件

- listing / detail / profile の acquisition、parser、normalizer の責務が分離されている。
- parser の input / output と、正規化前後の境界が明記されている。
- selector fallback が順序、失敗時の扱い、数値誤結合の禁止を含めて定義されている。
- CAMPFIRE と Makuake の sanitized fixture の保存場所と、fixture test の非live依存が定義されている。
- 将来の変更ファイル単位が明記され、LS-001 自体は挙動を変えない。
