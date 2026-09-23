---
agent: claude-opus-5 (subagent, T-006 seam owner)
session: sub
started: 2026-09-23T1800Z
ended: 2026-09-23T1830Z
scope: services/climate/climate/{ingest,worker}/**, services/climate/climate/snapshots.py, services/climate/tests/{ingest,worker}/**, services/climate/Dockerfile, .agent/tasks/T-006-ingest-worker.md
branch: feat/T-006-ingest-worker
status: done
---

## Did
- Open-Meteo forecast + AQ clients, IQAir/AQICN fallbacks gated on keys (`climate/ingest/`).
- Fixed B-012: current hour matched on HCMC wall-clock via Open-Meteo `utc_offset_seconds`; `forecast_days=2`.
- `snapshots.store_run`: obs + 5 snapshots (`pdim-s1`) + deduped alerts in the caller's transaction.
- arq worker `climate.worker.main.WorkerSettings`: cron every 15 min + at startup, publish `ucdt:events` after commit, skip the run on any upstream failure.
- Heat snapshot now stores heatController's reshape (lead review of T-007 found the raw service shape); other 4 controllers checked, pass-through.
- Dockerfile (api + worker, non-root). PR #23 into dev.

## Verified
- `uv run pytest tests/ingest tests/worker -q` -> 21 passed; `ruff check` / `format --check` clean; `uv run pytest -q` -> 144 passed.
- B-012 tests fail (2 failed) with legacy UTC matching patched back in.
- Real burst run on compose dev + live Open-Meteo: 5 hazards in risk_snapshots, events seen on `redis-cli SUBSCRIBE ucdt:events`, forecast[0].hour = local 01:00 at 01:21 ICT.
- Docker image builds, runs as uid 10001, imports the worker.

## Bugs
- Own bug, fixed in the PR: heat snapshot stored getHeatData, not the /api/heat controller shape (caught by the lead from T-007's side).
- B-012 fixed (board entry is the lead's to tick).
- Not a code bug, env: default `localhost` URLs time out / crawl on Windows (IPv6 first). Worked around with 127.0.0.1 env vars for the real run.

## Decisions
- Local hour from the upstream's `utc_offset_seconds`, not `zoneinfo` (no tzdata on Windows, no new deps).
- Alert `rule_id` = `A-<TYPE>`; storm alerts point at the weather snapshot, system at recommend.
- Worker tests commit, so they use their own DB `ucdt_test_worker`.

## Not done
- Two pre-fix heat snapshots remain in the dev DB (see task Handoff).
- `services/climate/.dockerignore` (outside scope) — suggested in the task Handoff.

## Left-next
- Lead: tick B-012, consider 127.0.0.1 defaults in `config.py`, review PR #23. T-010 wires the image (commands in the task Handoff).
