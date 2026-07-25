# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

COPY nest-cli.json tsconfig.json ./
COPY apps ./apps
COPY prisma ./prisma

RUN npm run prisma:generate
RUN npm run build

FROM builder AS production-dependencies

RUN npm prune --omit=dev

# Run this target once per release before starting the matching runtime image.
# It intentionally contains Prisma CLI but no application source or credentials.
FROM dependencies AS migration

COPY --chown=node:node prisma ./prisma
USER node

CMD ["npx", "--no-install", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]

# The Playwright image provides Chromium and its system libraries for both
# CAMPFIRE and Makuake acquisition. Keep its version aligned with package-lock.
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --chown=pwuser:pwuser package.json package-lock.json ./
COPY --chown=pwuser:pwuser --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=pwuser:pwuser --from=builder /app/dist ./dist

USER pwuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const http=require('node:http');const port=process.env.PORT||3000;const request=http.get({host:'127.0.0.1',port,path:'/health',timeout:4000},(response)=>{response.resume();process.exit(response.statusCode===200?0:1)});request.on('error',()=>process.exit(1));request.on('timeout',()=>{request.destroy();process.exit(1)})"]

CMD ["node", "dist/apps/api/main.js"]
