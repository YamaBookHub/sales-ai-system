# 15_CODEX.md

# Codex実装仕様書

Version: 1.0  
Status: Draft  
Target: MVP / Version 1  
Repository: `sales-ai-system`

---

## 1. 本書の目的

本書は、Codexに営業AIシステムのMVPを実装させるための実装仕様書である。

目的は、設計書全体をすべて完成させる前に、以下の最小機能を実装することである。

```text
CAMPFIRE URL入力
↓
ページ情報取得
↓
商品・ブランド・過去プロジェクト情報抽出
↓
AI分析
↓
営業メール生成
↓
人間編集
↓
品質チェック
↓
保存
```

MVPではメール自動送信は実装しない。

---

## 2. 実装対象

### 2.1 MVPで実装する機能

- Next.jsアプリ作成
- URL入力画面
- CAMPFIREページ取得
- PlaywrightによるHTML取得
- Cheerioによる情報抽出
- プロジェクト情報保存
- 過去プロジェクト取得
- AI分析
- 営業メール生成
- メール編集
- 品質チェック
- 履歴保存
- Supabase / PostgreSQL連携
- Prisma導入

### 2.2 MVPで実装しない機能

- メール自動送信
- Gmail連携
- 返信管理
- クリック計測
- 本格RAG
- 提案書生成
- 見積生成
- 契約管理

---

## 3. 技術スタック

以下で実装する。

- Frontend: Next.js
- Language: TypeScript
- Styling: Tailwind CSS
- Backend: Next.js Route Handlers
- Database: PostgreSQL / Supabase
- ORM: Prisma
- Scraping: Playwright
- HTML Parsing: Cheerio
- AI: OpenAI API
- Hosting想定: Vercel

---

## 4. ディレクトリ構成

以下の構成で実装する。

```text
sales-ai-system/
├── README.md
├── .env.example
├── package.json
├── prisma/
│   └── schema.prisma
├── docs/
├── prompts/
│   ├── brand-analysis.md
│   ├── product-analysis.md
│   ├── sns-analysis.md
│   ├── sales-strategy.md
│   ├── mail-generation.md
│   └── quality-check.md
├── app/
│   ├── page.tsx
│   ├── projects/
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   └── api/
│       ├── run/route.ts
│       ├── scrape/route.ts
│       ├── projects/route.ts
│       └── projects/[id]/
│           ├── route.ts
│           ├── analysis/route.ts
│           ├── mail/route.ts
│           └── quality-check/route.ts
├── components/
├── lib/
│   ├── prisma.ts
│   ├── openai.ts
│   ├── scraper/
│   │   ├── campfire.ts
│   │   └── types.ts
│   ├── ai/
│   │   ├── analyze.ts
│   │   ├── mail.ts
│   │   └── quality.ts
│   └── utils/
└── types/
```

---

## 5. 環境変数

`.env.example` を作成する。

```env
DATABASE_URL=
OPENAI_API_KEY=
```

---

## 6. DB実装

Prismaで以下のモデルを実装する。

### 6.1 Project

営業対象案件。

```prisma
model Project {
  id              String   @id @default(uuid())
  sourceSite      String
  sourceUrl       String   @unique
  projectTitle    String?
  executorName    String?
  brandName       String?
  companyName     String?
  productName     String?
  supportAmount   String?
  supporters      String?
  achievementRate String?
  daysLeft        String?
  status          String   @default("not_analyzed")
  priority        String?
  memo            String?
  rawHtml         String?
  scrapedJson     Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  analyses        Analysis[]
  mails           GeneratedMail[]
  histories       History[]
  aiRuns          AIRun[]
}
```

### 6.2 PastProject

```prisma
model PastProject {
  id              String   @id @default(uuid())
  projectId       String
  title           String?
  url             String?
  supportAmount   String?
  supporters      String?
  achievementRate String?
  category        String?
  memo            String?
  createdAt       DateTime @default(now())

  project         Project  @relation(fields: [projectId], references: [id])
}
```

### 6.3 Analysis

```prisma
model Analysis {
  id              String   @id @default(uuid())
  projectId       String
  type            String
  aiContent       Json?
  humanContent    Json?
  approvedContent Json?
  confidence      String?
  evidence        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  project         Project  @relation(fields: [projectId], references: [id])
}
```

### 6.4 GeneratedMail

```prisma
model GeneratedMail {
  id             String   @id @default(uuid())
  projectId      String
  templateType   String?
  subject        String?
  aiBody         String?
  humanBody      String?
  approvedBody   String?
  qualityResult  Json?
  status         String   @default("draft")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  project        Project  @relation(fields: [projectId], references: [id])
}
```

### 6.5 History

```prisma
model History {
  id          String   @id @default(uuid())
  projectId   String
  action      String
  before      Json?
  after       Json?
  comment     String?
  createdBy   String?
  createdAt   DateTime @default(now())

  project     Project  @relation(fields: [projectId], references: [id])
}
```

### 6.6 AIRun

```prisma
model AIRun {
  id          String   @id @default(uuid())
  projectId   String?
  aiType      String
  modelName   String?
  promptName  String?
  input       Json?
  output      Json?
  status      String
  error       String?
  startedAt   DateTime @default(now())
  completedAt DateTime?

  project     Project? @relation(fields: [projectId], references: [id])
}
```

### 6.7 Knowledge

```prisma
model Knowledge {
  id        String   @id @default(uuid())
  type      String
  title     String
  content   String
  tags      String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## 7. API実装

### 7.1 POST `/api/run`

URL入力から分析・メール生成まで実行する。

#### Request

```json
{
  "url": "https://camp-fire.jp/projects/935270/view"
}
```

#### 処理

1. URL検証
2. CAMPFIREページ取得
3. 情報抽出
4. Project保存
5. PastProject保存
6. AI分析
7. 営業メール生成
8. 品質チェック
9. History保存

#### Response

```json
{
  "success": true,
  "data": {
    "projectId": "uuid"
  }
}
```

---

### 7.2 POST `/api/scrape`

スクレイピングのみ実行する。

---

### 7.3 GET `/api/projects`

案件一覧取得。

---

### 7.4 GET `/api/projects/:id`

案件詳細取得。

---

### 7.5 GET `/api/projects/:id/analysis`

分析結果取得。

---

### 7.6 POST `/api/projects/:id/mail`

営業メール再生成。

---

### 7.7 PATCH `/api/projects/:id/mail`

人間修正メールを保存。

---

### 7.8 POST `/api/projects/:id/quality-check`

品質チェック実行。

---

## 8. スクレイピング実装

### 8.1 対象

初期対象はCAMPFIRE。

### 8.2 実装ファイル

`lib/scraper/campfire.ts`

### 8.3 取得項目

```ts
type ScrapedProject = {
  projectUrl: string;
  projectId: string;
  projectTitle?: string;
  executorName?: string;
  brandName?: string;
  companyName?: string;
  productName?: string;
  supportAmount?: string;
  supporters?: string;
  achievementRate?: string;
  daysLeft?: string;
  description?: string;
  profileUrl?: string;
  pastProjects: ScrapedPastProject[];
  rawHtml?: string;
};
```

### 8.4 実装要件

- Playwrightでページを開く
- `networkidle` まで待機
- HTMLを取得
- Cheerioでパース
- セレクタは複数候補を持たせる
- 取得できない項目があっても処理を止めない
- エラー時は `SCRAPING_FAILED` を返す

---

## 9. AI分析実装

### 9.1 実装ファイル

- `lib/ai/analyze.ts`
- `lib/ai/mail.ts`
- `lib/ai/quality.ts`

### 9.2 分析種別

以下を生成する。

- brand
- product
- past_project
- sns
- strategy

### 9.3 AI出力形式

AIはJSONで返す。

```json
{
  "brand": {},
  "product": {},
  "pastProject": {},
  "sns": {},
  "strategy": {}
}
```

### 9.4 AIルール

AIには必ず以下を守らせる。

- 確認できない事実は書かない
- 商品性能を保証しない
- 会社の課題を断定しない
- 「訴求」という言葉を使わない
- 「改善できます」と書かない
- 人間が修正できる下書きとして出力する

---

## 10. メール生成仕様

### 10.1 固定自己紹介

```text
お世話になっております。
株式会社第弐ヴォヌールの山本と申します。
```

### 10.2 固定実績

```text
実績としては、SNS運用で1か月総再生400万回超、
クラウドファンディング領域では、担当商品で3,500万円規模の売上実績がございます。
```

### 10.3 締め文

```text
もし何かお力になれそうな機会がございましたら、
お気軽にご連絡いただけますと幸いです。
```

### 10.4 件名

```text
CAMPFIREでのプロジェクトを拝見しご連絡いたしました
```

---

## 11. UI実装

### 11.1 MVP画面

以下を実装する。

- Dashboard
- New Analysis
- Project Detail
- Mail Editor
- Quality Check

### 11.2 Dashboard

案件一覧を表示する。

### 11.3 New Analysis

URL入力欄と分析開始ボタンを表示する。

### 11.4 Project Detail

以下を表示する。

- 基本情報
- ブランド分析
- 商品分析
- SNS分析
- 営業切り口
- 生成メール
- 品質チェック

### 11.5 Mail Editor

件名・本文を編集可能にする。

---

## 12. 品質チェック実装

### 12.1 チェック項目

- 会社名誤り
- 商品名誤り
- 別案件混入
- 断定表現
- 「訴求」の使用
- 「改善できます」の使用
- 実績表現の過剰
- 誤字脱字

### 12.2 結果形式

```json
{
  "isSafeToUse": true,
  "issues": [],
  "warnings": [],
  "suggestedFixes": []
}
```

---

## 13. エラー処理

共通エラー形式を使用する。

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "日本語エラーメッセージ"
}
```

主なエラーコード：

- VALIDATION_ERROR
- SCRAPING_FAILED
- AI_ANALYSIS_FAILED
- MAIL_GENERATION_FAILED
- QUALITY_CHECK_FAILED
- DATABASE_ERROR

---

## 14. README更新

READMEには以下を記載する。

- 概要
- 技術スタック
- セットアップ
- 環境変数
- Prismaマイグレーション
- Playwrightセットアップ
- 起動方法
- 使い方
- 注意事項

---

## 15. セットアップコマンド

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx playwright install
npm run dev
```

---

## 16. 完了条件

以下を満たすこと。

- `npm install` が通る
- `npm run dev` で起動する
- URL入力画面が表示される
- CAMPFIRE URLを入力できる
- ProjectがDBに保存される
- AI分析が生成される
- 営業メールが生成される
- メール本文を編集できる
- 品質チェックができる
- TypeScriptエラーがない
- ESLintエラーがない
- READMEが整備されている

---

## 17. Codexへの実装指示

Codexは本書に従ってMVPを実装すること。

設計書に明記されていない高度な機能は実装しない。

まずは以下の流れを最優先で動作させる。

```text
URL入力
↓
CAMPFIRE情報取得
↓
DB保存
↓
AI分析
↓
営業メール生成
↓
編集
↓
品質チェック
```

メール送信、RAG、本格CRMは実装しない。
