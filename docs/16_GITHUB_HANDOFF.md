# 16_GITHUB_HANDOFF.md

## GitHub反映手順書

## 1. 結論
ZIPを展開し、`docs/`、`prisma/`、`openapi/` を既存リポジトリに反映する。反映前に必ずブランチを切る。

## 2. 手順
```bash
git checkout main
git pull origin main
git checkout -b docs/sales-ai-system-v1-reviewed
cp -R sales-ai-system-v1/docs ./docs
cp -R sales-ai-system-v1/prisma ./prisma
cp -R sales-ai-system-v1/openapi ./openapi
npx prisma validate
git add docs prisma openapi
git commit -m "docs: add reviewed sales ai system v1 specs"
git push origin docs/sales-ai-system-v1-reviewed
```

## 3. PR本文
営業AIシステムv1の実装仕様、Prisma schema、OpenAPIを追加。メール送信は承認制、初期はMAIL_SEND_ENABLED=false前提。

## 4. 次工程
Codexへ `15_CODEX.md` の順序で実装開始させる。


---

## Codex実装条件
- docs/ を正本として実装する。
- DB変更時は `docs/07_DATABASE.md` と `prisma/schema.prisma` を同時更新する。
- API変更時は `docs/06_API.md` と `openapi/openapi.yaml` を同時更新する。
- AI生成・メール送信・承認・配信停止は必ずログを残す。
- MVPではAI生成メールの自動送信は禁止。人間承認を必須にする。
