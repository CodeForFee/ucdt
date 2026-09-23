#!/usr/bin/env bash
# Production deploy for the UCDT stack. Run on the VPS from the repo root:
#   infra/deploy.sh
# Rollback to a specific build:
#   UCDT_TAG=sha-abc1234 infra/deploy.sh
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE="infra/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "deploy.sh: $ENV_FILE not found -- copy infra/.env.example to infra/.env and fill it in first" >&2
    exit 1
fi

COMPOSE=(docker compose -f infra/compose.yml -f infra/compose.prod.yml)

echo "==> git pull --ff-only"
git pull --ff-only

echo "==> pulling images (UCDT_TAG=${UCDT_TAG:-main})"
"${COMPOSE[@]}" pull

echo "==> starting stack"
"${COMPOSE[@]}" up -d --no-build --remove-orphans --wait

echo "==> service health"
"${COMPOSE[@]}" ps

echo "==> pruning dangling images"
docker image prune -f

echo "==> deploy complete"
