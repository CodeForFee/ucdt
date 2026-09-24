---
id: T-012
title: CI complete + GHCR
owner: claude-sonnet-5 (subagent)
scope: .github/workflows/**
exit: CI green on its own PR; the contracts drift check fails on a deliberate drift
phase: review
blocked:
created: 2026-09-23T1617Z
sprint: S-001
issue: 13
---

## Plan
ruff/pytest (with a postgres service), bun test/tsc, web lint/test/build, contracts `git diff --exit-code`, build + push images to ghcr.io on main.

## Execute
- `.github/workflows/climate.yml`: added `concurrency` (cancel-in-progress per ref), `timeout-minutes: 15`, `astral-sh/setup-uv@v6` cache (`enable-cache: true`), and the contracts drift check as the last steps of the same job (it already has both a Python toolchain and, now, pnpm): `uv run python -m climate.api.dump_openapi` (T-007's exact regen command) → `pnpm -F @ucdt/contracts gen` → `git diff --exit-code -- packages/contracts`. The three extra steps run with `working-directory: ${{ github.workspace }}` since the job's `defaults.run.working-directory` is `services/climate`.
- `.github/workflows/gateway.yml` / `web.yml`: added `concurrency` (cancel-in-progress) and `timeout-minutes: 10`; both already had `pnpm`/`setup-node` caching, no other change needed. Job names (`climate`, `gateway`, `web`) are unchanged and still have no path filters.
- New `.github/workflows/images.yml`: three jobs (`climate`, `gateway`, `web`), triggers `push` (main/dev), `pull_request`, `workflow_dispatch`; workflow-level `permissions: contents: read, packages: write`; `concurrency` cancel-in-progress per ref; `timeout-minutes: 20` each. Each job: `docker/setup-buildx-action`, `docker/login-action` to ghcr.io with `GITHUB_TOKEN` (`if: github.event_name != 'pull_request'`), `docker/metadata-action` (tags: `type=ref,event=branch`, `type=sha,format=short,prefix=sha-`, `type=raw,value=latest` enabled only on `main` pushes; `flavor: latest=false` to stop the action's own implicit latest tag), `docker/build-push-action` with `push: ${{ github.event_name != 'pull_request' }}` and `cache-from`/`cache-to: type=gha` (scoped per image). Images: `ghcr.io/codeforfee/ucdt-climate` (context `services/climate`), `ghcr.io/codeforfee/ucdt-gateway` (context `.`, file `apps/gateway/Dockerfile`), `ghcr.io/codeforfee/ucdt-web` (context `.`, file `infra/web.Dockerfile`, build-arg `VITE_MAPBOX_TOKEN` from the secret). The `web` job first runs a shell step that checks `secrets.VITE_MAPBOX_TOKEN`; if empty it emits `::warning::` and every later step in that job is skipped via `if: steps.token_check.outputs.has_token == 'true'` — the job still succeeds, and the image is never built with a placeholder.

## Review
- Considered a matrix for climate+gateway to cut duplication, but web's secret-gated skip logic doesn't fit a matrix cleanly and three short explicit jobs are easier for T-013 to read than a matrix plus one odd job out.
- Did not touch `infra/web.Dockerfile`'s two `SecretsUsedInArgOrEnv` docker-build warnings (VITE_MAPBOX_TOKEN as ARG/ENV) — pre-existing, owned by T-010, and the token is documented as a public URL-scoped value, not a secret in the security sense.

## Test
```
$ cd services/climate && uv run python -m climate.api.dump_openapi && cd .. && pnpm -F @ucdt/contracts gen && git diff --exit-code -- packages/contracts; echo EXIT=$?
wrote .../packages/contracts/openapi.json
🚀 openapi.json → src/schema.ts [34.3ms]
EXIT=0

# deliberate drift: edited models.py Latest.observedAt Field(description=...) to add "DELIBERATE DRIFT TEST"
$ uv run python -m climate.api.dump_openapi && pnpm -F @ucdt/contracts gen && git diff --exit-code -- packages/contracts; echo EXIT=$?
diff --git a/packages/contracts/openapi.json ... (5 hazards' observedAt description changed)
diff --git a/packages/contracts/src/schema.ts ... (5 hazards' JSDoc @description changed)
EXIT=1

# reverted models.py, regenerated again -> clean
$ uv run python -m climate.api.dump_openapi && pnpm -F @ucdt/contracts gen && git diff --exit-code -- packages/contracts; echo EXIT=$?
EXIT=0

$ cd services/climate && uv run ruff check . && uv run ruff format --check .
All checks passed!
40 files already formatted

$ MSYS_NO_PATHCONV=1 docker run --rm -v "//.../ucdt:/repo" -w //repo rhysd/actionlint:latest -color; echo EXIT=$?
EXIT=0   (no findings across all 4 workflows)

$ docker build -t ucdt-climate-test ./services/climate            -> builds, exports image
$ docker build -t ucdt-gateway-test -f apps/gateway/Dockerfile .  -> builds, exports image
$ docker build -t ucdt-web-test -f infra/web.Dockerfile --build-arg VITE_MAPBOX_TOKEN=pk.placeholder . -> builds, vite build succeeds, exports image
$ docker rmi ucdt-climate-test ucdt-gateway-test ucdt-web-test    -> removed
```
Not run locally: the PostGIS-backed `pytest` job (needs the compose postgres service CI provides) and the actual GHCR push (needs `GITHUB_TOKEN`/PR context) — both are asserted by the PR's own CI run instead (see PR "Verify" section for the live run link/output).

## Handoff
- Image name + tag contract for T-013: `ghcr.io/codeforfee/ucdt-{climate,gateway,web}`, tags `dev`/`main` (branch name), `sha-<short>`, `latest` (main only). Do not change without updating T-013.
- If GitHub's "Automatically delete head branches" setting causes `dev` to be recreated (per the board's dev-after-promotion note), the `push: branches: [main, dev]` triggers here need no change — they match by name, not by existence at workflow-parse time.
