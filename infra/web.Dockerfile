# Vite build of apps/web, served by Caddy (which also reverse-proxies /api to the gateway).
# Build context: the repo root (pnpm workspace + lockfile).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...
COPY apps/web apps/web
# VITE_* are baked into the bundle — public values, never secrets (see infra/.env.example).
ARG VITE_MAPBOX_TOKEN
ARG VITE_API_BASE_URL=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm -F web build

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
