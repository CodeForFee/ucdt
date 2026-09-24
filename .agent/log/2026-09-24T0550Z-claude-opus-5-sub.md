---
agent: claude-opus-5
session: sub
started: 2026-09-24T0540Z
ended: 2026-09-24T0600Z
scope: services/climate/climate/{pdim/**,snapshots.py,worker/**,db/repo.py}; services/climate/tests/{pdim,worker,db}/**; .agent/tasks/T-103-processing-per-unit.md; this log
branch: feat/T-103-processing
status: done (PR open, awaiting lead review)
---

## Did
- Per-unit PDIM (spec §B–§D) on the catalogue; flood decomposition city + per zone (B-014).
- Per-unit rule base with π(r,i), E(i) = clamp(builtUp, 0.1, 1), top-10 + firedCount (§E).
- Per-unit band-rise alerts vs the previous snapshot, spec ids/expiries, no system alert (§F).
- `run_counterfactual` (§G); legacy `run_simulation` kept for the current API only.
- `pdim/maturity.py` Algorithm 1 + repo history reads; S2 γ drive the served nowcast.
- Worker: per-unit weather, AirGradient into aqi_obs `ag:<id>`, station → nearest point.

## Verified
- pytest 266 passed (tests/api untouched and green); ruff check + format clean.
- Real burst on the dev DB (Redis db 1): 5 snapshots in the S-002 shape; decomposition of
  gz-q6-binh-tien sums to 0.4114105 → R_f 0.411; top-3 π 1.52/1.51/1.49; maturity aqi S1, 0/168.

## Bugs
- The compose climate-worker (old image) consumes jobs a local `arq --burst` enqueues on Redis
  db 0 — my first burst ran the OLD code and wrote old-shape snapshots. Use another db.
- R-AQI-03 legacy label "trung bình"/"moderate" for AQI 101–150 (EPA: sensitive groups) — fixed.

## Decisions
- Rules and alerts read the SERVED (rounded) per-unit values for now, previous and counterfactual.
- §H: V pools all open-network stations; CI around the unclamped OLS estimate.

## Not done / Left-next
- T-104: api/models.py (FloodTriggers requires soilSaturation), /v1/simulation → run_counterfactual,
  /v1/maturity → snapshots.evaluate_maturity; full list in the task file Handoff.
- MAP.md stale (hook); dev DB at alembic 001; compose worker image must be rebuilt after merge.
