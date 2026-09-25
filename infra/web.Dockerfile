# Vite build of apps/web, served by nginx (which also reverse-proxies /api to the gateway).
# Build context: the repo root (pnpm workspace + lockfile).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...
COPY packages/contracts packages/contracts
COPY apps/web apps/web
# VITE_* are baked into the bundle — public values, never secrets (see infra/.env.example).
ARG VITE_MAPBOX_TOKEN
ARG VITE_API_BASE_URL=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm -F web build

# nginx:1.27-alpine links against openssl but does NOT ship the CLI — install it explicitly
# for infra/certbot/dummy-cert.sh (found the hard way: nginx-cert-init exited 127 on first
# live deploy, "openssl: not found"). The image already has the official docker-entrypoint.d
# envsubst hook that turns *.template into conf.d/*.conf at startup.
FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY infra/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
