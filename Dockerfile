# 나도으른 — 주최 측 실행·CI 용 이미지. 빌드는 여기서 끝내고 시작 명령은 시드 + 서버 실행만 한다.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG RELEASE_ID=dev
ENV RELEASE_ID=$RELEASE_ID \
    NEXT_PUBLIC_DATA_BACKEND=local \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_PUBLIC_DATA_BACKEND=local \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts/docker-start.mjs ./docker-start.mjs
COPY --from=build /app/src/lib/data/local/schema.sql ./schema.sql
COPY --from=build /app/seed ./seed
RUN mkdir -p /data/storage
EXPOSE 3000
CMD ["node", "docker-start.mjs"]
