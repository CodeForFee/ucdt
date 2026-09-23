FROM oven/bun:1.3-alpine

WORKDIR /app

# Gateway has no workspace:* dependencies (just hono), so it installs standalone.
COPY apps/gateway/package.json ./
RUN bun install --production

COPY apps/gateway/tsconfig.json ./
COPY apps/gateway/src ./src

RUN addgroup -S gateway && adduser -S -G gateway gateway
USER gateway

ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "src/index.ts"]
