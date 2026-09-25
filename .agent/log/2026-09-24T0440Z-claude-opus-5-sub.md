---
agent: claude-opus-5
session: sub
started: 2026-09-24T0440Z
ended: 2026-09-24T0530Z
scope: services/climate/climate/spatial/**; services/climate/climate/db/migrations/versions/002_*.py; services/climate/tests/spatial/**; .agent/tasks/T-101-static-layers-toponyms.md; this log (+ minimal forced edits in tests/pdim/test_pdim_parity.py, tests/worker/test_worker.py)
branch: feat/T-101-static-layers-v2
status: done (PR open, awaiting lead review)
---

## Did
- Cherry-picked WIP 5bc2141 onto origin/dev (clean), reviewed it against spec §A.1–§A.4 (#55, #57).
- Added the committed response cache to derive.py; re-derived from the network, then offline.
- Migration 002 reduced to renames; removed LEGACY_HEAT_NAMES from units.py; parity/worker tests
  expect current names by id.
- New tests: offline replay, migration roundtrip (ucdt_test_spatial), fractions, catalogue.

## Verified
- Networked derive == WIP derived.json byte for byte; offline (dead proxy) re-run leaves
  derived.json and derive_cache.json hashes unchanged.
- ruff check/format clean; pytest tests/spatial tests/db 86 passed; full pytest 268 passed.

## Bugs
- WIP migration 002 merged derived props into spatial_units → tests/db/test_db_repo.py failed.
- WIP had no cache and stamped `retrieved` with today's date → not reproducible.
- Renames broke tests/worker/test_worker.py as well as the parity test (WIP only fixed parity).
- climate/ingest/names.py is_admin_label false-positives "Lạc Long Quân" (by design for stations;
  do not reuse it for unit names).

## Decisions
- Static layers stay in derived.json only (not in the DB); the cache is committed (1.36 MB) so
  anyone can replay the derivation offline and CI checks it.

## Not done / Left-next
- T-103 consumes catalogue; T-104 serves `commune` from catalogue (the DB has no static layers).
- MAP.md is stale (hook reports it); not refreshed here (out of scope).
