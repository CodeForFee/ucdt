# 2026-09-24T0604Z — claude-opus-5 (subagent) — T-104 API + contracts + gateway (#49)

Branch `feat/T-104-api-contracts-gateway` from dev 6a1ce53.

## Did
- API models + routes for every S-002 payload T-103 (#60) changed; `/v1/maturity`;
  `/v1/simulation` on `run_counterfactual`; old-shape snapshots → 503 (latest: response-model
  validation; simulation: KeyError); alerts of pre-S-002 types filtered, critical first per run;
  `modelVersion` on every latest payload.
- Gateway `/api/maturity` (cache 600 s). Contracts regenerated, no drift.
- API tests rewritten to seed through `snapshots.store_run`; §A.1 name guard over all payloads.

## Verified
pytest 275 passed; ruff clean; bun test 29 pass; tsc clean; contracts regen no diff; live run
(worker burst db 1 → :8010 → :3010) every /api route 200 as expected, bad scenario 400,
maturity cache HIT on second call. Details in the task file.

## Left
- Dead `run_simulation` / `_legacy_flood_areas` (lead to delete; parity test still uses it).
- Compose worker/API images are old: they write old-shape snapshots → 502 until rebuilt.
- Spec §A.3 "commune table served by the API" is met only per recommendation item.
