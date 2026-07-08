# 06_API.md

# 営業AIシステム API設計書

Version: 1.0  
Status: Draft  
Target: MVP / Version 1

---

## 1. 本書の目的

本書は、営業AIシステムにおけるAPI仕様を定義する。

APIは、UI、スクレイピング処理、AI分析、メール生成、ナレッジ管理、履歴管理、DB保存処理を接続する役割を持つ。

本書は、Codexが実装時に迷わないよう、APIの責務、入力、出力、エラー形式、レイヤー構成、命名規則を定義する。

---

## 2. API設計方針

### 2.1 基本方針

- REST APIとして設計する
- JSONで入出力する
- 成功・失敗レスポンス形式を統一する
- AI処理とDB保存処理を分離する
- UIから直接AI APIを呼ばない
- すべての更新処理は履歴を保存する
- Human in the Loopを前提に、AI生成データと人間修正データを区別する

---

## 3. レイヤー構成

実装は以下のレイヤー構成を基本とする。

```text
Route Handler
  ↓
Controller
  ↓
UseCase
  ↓
Service
  ↓
Repository
  ↓
Database / External API / AI API
```

### 3.1 Route Handler

Next.jsのRoute Handlerを利用する。

責務：

- HTTPリクエストを受け取る
- 認証確認を行う
- Controllerへ処理を渡す
- レスポンスを返す

### 3.2 Controller

責務：

- リクエストパラメータの検証
- UseCaseの呼び出し
- エラー変換

### 3.3 UseCase

責務：

- 業務ロジックを実行する
- 複数Serviceを組み合わせる
- ステータス更新を制御する

### 3.4 Service

責務：

- AI処理
- スクレイピング処理
- メール生成処理
- 品質チェック処理

### 3.5 Repository

責務：

- DB操作
- Prisma経由での永続化
- クエリの集約

---

## 4. 共通レスポンス形式

### 4.1 成功レスポンス

```json
{
  "success": true,
  "data": {}
}
```

### 4.2 失敗レスポンス

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "エラーメッセージ",
  "details": {}
}
```

---

## 5. 共通エラーコード

| Code | 意味 |
|---|---|
| VALIDATION_ERROR | 入力値不正 |
| UNAUTHORIZED | 未認証 |
| FORBIDDEN | 権限不足 |
| PROJECT_NOT_FOUND | プロジェクトが存在しない |
| SCRAPING_FAILED | ページ取得失敗 |
| AI_ANALYSIS_FAILED | AI分析失敗 |
| MAIL_GENERATION_FAILED | メール生成失敗 |
| QUALITY_CHECK_FAILED | 品質チェック失敗 |
| DATABASE_ERROR | DB処理失敗 |
| UNKNOWN_ERROR | 不明なエラー |

---

## 6. API一覧

| 分類 | Method | Path | 概要 |
|---|---|---|---|
| Health | GET | `/api/health` | ヘルスチェック |
| Dashboard | GET | `/api/dashboard` | ダッシュボード集計 |
| Project | GET | `/api/projects` | 案件一覧取得 |
| Project | GET | `/api/projects/:id` | 案件詳細取得 |
| Project | PATCH | `/api/projects/:id` | 案件更新 |
| Run | POST | `/api/run` | URL分析一括実行 |
| Scrape | POST | `/api/scrape` | ページ取得 |
| Analysis | GET | `/api/projects/:id/analysis` | 分析一括取得 |
| Brand | GET | `/api/projects/:id/analysis/brand` | ブランド分析取得 |
| Brand | PATCH | `/api/projects/:id/analysis/brand` | ブランド分析更新 |
| Product | GET | `/api/projects/:id/analysis/product` | 商品分析取得 |
| Product | PATCH | `/api/projects/:id/analysis/product` | 商品分析更新 |
| SNS | GET | `/api/projects/:id/analysis/sns` | SNS分析取得 |
| SNS | PATCH | `/api/projects/:id/analysis/sns` | SNS分析更新 |
| Strategy | GET | `/api/projects/:id/strategy` | 営業切り口取得 |
| Strategy | PATCH | `/api/projects/:id/strategy` | 営業切り口更新 |
| Mail | POST | `/api/projects/:id/mail/generate` | メール生成 |
| Mail | GET | `/api/projects/:id/mail` | メール取得 |
| Mail | PATCH | `/api/projects/:id/mail` | メール更新 |
| Quality | POST | `/api/projects/:id/quality-check` | 品質チェック実行 |
| Quality | GET | `/api/projects/:id/quality-check` | 品質チェック取得 |
| Review | POST | `/api/projects/:id/approve` | 承認 |
| Review | POST | `/api/projects/:id/reject` | 差し戻し |
| History | GET | `/api/projects/:id/history` | 履歴取得 |
| Knowledge | GET | `/api/knowledge` | ナレッジ一覧 |
| Knowledge | POST | `/api/knowledge` | ナレッジ登録 |
| Knowledge | PATCH | `/api/knowledge/:id` | ナレッジ更新 |
| Knowledge | DELETE | `/api/knowledge/:id` | ナレッジ削除 |
| Settings | GET | `/api/settings` | 設定取得 |
| Settings | PATCH | `/api/settings` | 設定更新 |

---

## 7. Health API

### GET `/api/health`

### 目的

システムが稼働しているか確認する。

### Response

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

---

## 8. Dashboard API

### GET `/api/dashboard`

### 目的

営業案件の集計情報を取得する。

### Response

```json
{
  "success": true,
  "data": {
    "totalProjects": 120,
    "notAnalyzed": 20,
    "analyzed": 80,
    "mailGenerated": 50,
    "approved": 20,
    "sent": 0,
    "replied": 0,
    "meetings": 0,
    "contracts": 0
  }
}
```

---

## 9. Project API

### 9.1 GET `/api/projects`

### 目的

営業案件一覧を取得する。

### Query

| Name | Required | Description |
|---|---|---|
| keyword | no | 検索キーワード |
| status | no | ステータス |
| site | no | 対象サイト |
| confidence | no | AI信頼度 |
| page | no | ページ番号 |
| limit | no | 件数 |

### Response

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120
    }
  }
}
```

---

### 9.2 GET `/api/projects/:id`

### 目的

案件詳細を取得する。

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectUrl": "",
    "site": "CAMPFIRE",
    "projectTitle": "",
    "executorName": "",
    "brandName": "",
    "companyName": "",
    "supportAmount": "",
    "supporters": "",
    "achievementRate": "",
    "daysLeft": "",
    "status": "ANALYZED",
    "confidence": "medium",
    "createdAt": "",
    "updatedAt": ""
  }
}
```

---

### 9.3 PATCH `/api/projects/:id`

### 目的

案件基本情報を更新する。

### Request

```json
{
  "brandName": "",
  "companyName": "",
  "status": "",
  "priority": "",
  "memo": ""
}
```

---

## 10. Run API

### POST `/api/run`

### 目的

URL入力から、スクレイピング、AI分析、メール生成までを一括実行する。

### Request

```json
{
  "url": "https://camp-fire.jp/projects/935270/view"
}
```

### 処理順序

1. URL検証
2. プロジェクト情報取得
3. 過去プロジェクト取得
4. ブランド分析
5. 商品分析
6. SNS分析
7. 営業切り口分析
8. メール生成
9. 品質チェック
10. DB保存

### Response

```json
{
  "success": true,
  "data": {
    "projectId": "uuid",
    "status": "ANALYZED"
  }
}
```

---

## 11. Scrape API

### POST `/api/scrape`

### 目的

対象URLからページ情報を取得する。

### Request

```json
{
  "url": "https://camp-fire.jp/projects/935270/view"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "project": {},
    "pastProjects": [],
    "rawHtmlStored": true
  }
}
```

---

## 12. Analysis API

### 12.1 GET `/api/projects/:id/analysis`

### 目的

分析結果を一括取得する。

### Response

```json
{
  "success": true,
  "data": {
    "brand": {},
    "product": {},
    "pastProjects": [],
    "sns": {},
    "strategy": {},
    "quality": {}
  }
}
```

---

## 13. Brand Analysis API

### GET `/api/projects/:id/analysis/brand`

ブランド分析を取得する。

### PATCH `/api/projects/:id/analysis/brand`

ブランド分析を人間が修正する。

### Request

```json
{
  "brandSummary": "",
  "brandAxis": "",
  "mainGenres": [],
  "usableMailPoint": "",
  "confidence": "medium",
  "revisionReason": ""
}
```

---

## 14. Product Analysis API

### GET `/api/projects/:id/analysis/product`

商品分析を取得する。

### PATCH `/api/projects/:id/analysis/product`

商品分析を人間が修正する。

### Request

```json
{
  "productName": "",
  "category": "",
  "features": [],
  "strengths": [],
  "targetUsers": [],
  "useCases": [],
  "usableMailPoint": "",
  "revisionReason": ""
}
```

---

## 15. SNS Analysis API

### GET `/api/projects/:id/analysis/sns`

SNS分析を取得する。

### PATCH `/api/projects/:id/analysis/sns`

SNS分析を更新する。

### Request

```json
{
  "snsFit": "high",
  "shortVideoIdeas": [],
  "adCreativeIdeas": [],
  "firstThreeSecondHook": "",
  "usableMailPoint": "",
  "revisionReason": ""
}
```

---

## 16. Sales Strategy API

### GET `/api/projects/:id/strategy`

営業切り口を取得する。

### PATCH `/api/projects/:id/strategy`

営業切り口を更新する。

### Request

```json
{
  "recommendedAngle": "",
  "recommendedTemplate": "normal",
  "reason": "",
  "supportPoints": [],
  "revisionReason": ""
}
```

---

## 17. Mail API

### 17.1 POST `/api/projects/:id/mail/generate`

営業メールを生成する。

### Response

```json
{
  "success": true,
  "data": {
    "templateType": "normal",
    "subject": "",
    "body": "",
    "usedAnalysisPoints": []
  }
}
```

---

### 17.2 GET `/api/projects/:id/mail`

営業メールを取得する。

---

### 17.3 PATCH `/api/projects/:id/mail`

営業メールを人間が編集する。

### Request

```json
{
  "subject": "",
  "body": "",
  "revisionReason": ""
}
```

---

## 18. Quality Check API

### POST `/api/projects/:id/quality-check`

品質チェックを実行する。

### Response

```json
{
  "success": true,
  "data": {
    "isSafeToUse": true,
    "issues": [],
    "warnings": [],
    "suggestedFixes": []
  }
}
```

---

## 19. Review API

### POST `/api/projects/:id/approve`

営業メールを承認済みにする。

### Request

```json
{
  "comment": ""
}
```

### POST `/api/projects/:id/reject`

差し戻しする。

### Request

```json
{
  "reason": ""
}
```

---

## 20. History API

### GET `/api/projects/:id/history`

案件の履歴を取得する。

### Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "action": "",
        "before": {},
        "after": {},
        "createdAt": "",
        "createdBy": ""
      }
    ]
  }
}
```

---

## 21. Knowledge API

### GET `/api/knowledge`

ナレッジ一覧を取得する。

### POST `/api/knowledge`

ナレッジを登録する。

### Request

```json
{
  "title": "",
  "type": "",
  "content": "",
  "tags": []
}
```

### PATCH `/api/knowledge/:id`

ナレッジを更新する。

### DELETE `/api/knowledge/:id`

ナレッジを削除する。

---

## 22. Settings API

### GET `/api/settings`

設定を取得する。

### PATCH `/api/settings`

設定を更新する。

---

## 23. Orchestrator API

### POST `/api/orchestrator/run`

### 目的

複数AIを順番に実行する。

### Request

```json
{
  "projectId": "uuid",
  "mode": "full"
}
```

### mode

| Mode | 内容 |
|---|---|
| full | 全分析を実行 |
| brand | ブランド分析のみ |
| product | 商品分析のみ |
| sns | SNS分析のみ |
| mail | メール生成のみ |
| quality | 品質チェックのみ |

---

## 24. 認証・認可

MVPでは簡易認証を前提とする。  
将来的にはSupabase Authを利用する。

### Role

- admin
- manager
- sales

### 権限

| API | sales | manager | admin |
|---|---|---|---|
| GET系 | 可 | 可 | 可 |
| URL登録 | 可 | 可 | 可 |
| 分析編集 | 可 | 可 | 可 |
| メール編集 | 可 | 可 | 可 |
| 承認 | 不可 | 可 | 可 |
| 設定変更 | 不可 | 不可 | 可 |

---

## 25. API完了条件

- UIで必要な情報を取得できる
- AI分析を実行できる
- 分析結果を保存できる
- 人間修正を保存できる
- 営業メールを生成できる
- 営業メールを編集できる
- 品質チェックを実行できる
- 承認・差し戻しができる
- 履歴を取得できる
- エラー形式が統一されている
