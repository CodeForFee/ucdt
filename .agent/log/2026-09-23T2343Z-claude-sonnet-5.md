# 2026-09-23T2343Z claude-sonnet-5 — T-012 CI complete + GHCR (#13)

## Task
T-012: keep the three required CI jobs (`climate`, `gateway`, `web`) with no path filters, harden them cheaply, add a contracts drift check to the `climate` job, and add a new `images.yml` workflow that builds (and, off PR, pushes) the three GHCR images the stack runs from.

## Did
- `.github/workflows/climate.yml`: added per-ref cancel-in-progress `concurrency`, `timeout-minutes: 15`, uv cache, and — as the last steps of the same job — the contracts drift check: `uv run python -m climate.api.dump_openapi` → `pnpm -F @ucdt/contracts gen` → `git diff --exit-code -- packages/contracts` (the exact T-007 regen sequence).
- `.github/workflows/gateway.yml`, `web.yml`: added `concurrency` + `timeout-minutes`; pnpm/node caching was already present.
- New `.github/workflows/images.yml`: three jobs (`climate`, `gateway`, `web`), triggers `push` (main/dev) + `pull_request` + `workflow_dispatch`, workflow-level `permissions: contents: read, packages: write`, `docker/setup-buildx-action` + `docker/login-action` (skipped on PR) + `docker/metadata-action` + `docker/build-push-action` with GHA layer cache. Images: `ghcr.io/codeforfee/ucdt-{climate,gateway,web}`; tags = branch name, `sha-<short>`, `latest` (main only). PRs build only (`push: false`), never push. The `web` job checks `secrets.VITE_MAPBOX_TOKEN` first; if empty it emits `::warning::` and skips every remaining step in that job (succeeds, never builds with a placeholder).
- Updated `.agent/tasks/T-012-ci-ghcr.md` (phase -> review, Execute/Review/Test/Handoff filled in).

## Verified
- Drift check proven both ways: baseline regen is clean (exit 0); edited `services/climate/climate/api/models.py` `Latest.observedAt`'s `Field(description=...)` to add `"DELIBERATE DRIFT TEST"`, regenerated `openapi.json` + `src/schema.ts`, and `git diff --exit-code -- packages/contracts` exited 1 with the expected diff across all 5 hazard response models; reverted the model edit, regenerated again, back to exit 0 / no diff.
- `uv run ruff check .` and `uv run ruff format --check .` both pass.
- `actionlint` (via `rhysd/actionlint:latest` in Docker) reports zero findings across all four workflow files.
- Built all three images locally with plain `docker build`: `services/climate` (Dockerfile default), `apps/gateway/Dockerfile` from repo root, `infra/web.Dockerfile` from repo root with `--build-arg VITE_MAPBOX_TOKEN=pk.placeholder` — all three built and exported an image; removed the local test images afterward.
- `git diff --stat` confirms only `.github/workflows/{climate,gateway,web,images}.yml` changed — no drift left behind in `packages/contracts` or `services/climate`.

## Not done
- Did not run the full `uv run pytest` suite locally (needs the compose Postgres service that CI's `postgres` service container provides; not started here) — CI on the PR is the real verification for that job, referenced in the PR's Verify section.
- Did not exercise the actual GHCR push path (needs `GITHUB_TOKEN` in an Actions run and a non-PR event) or the `VITE_MAPBOX_TOKEN` GitHub secret (user is still adding it) — both are proven structurally (login/build steps gated correctly) and will show up as real CI runs on the PR once opened.

## Left / next
- PR opened into `dev` (see PR body for the live CI run link and its output) — tech lead to review and merge; T-012 stays `phase: review` until then.
- T-013 (deploy) can rely on the three GHCR image names and the `dev`/`main`/`sha-<short>`/`latest` tag scheme now — do not change them without updating T-013's plan.
- Once the user adds the `VITE_MAPBOX_TOKEN` secret, the `web` job in `images.yml` will start building/pushing for real; until then it warns and skips cleanly, so no action is required from the lead.
