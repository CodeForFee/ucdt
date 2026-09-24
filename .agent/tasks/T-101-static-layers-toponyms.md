---
id: T-101
title: static layers (DEM, WorldCover, OSM) + toponym renames
owner: claude-opus-5 (subagent, v2)
scope: services/climate/climate/spatial/**, services/climate/climate/db/migrations/versions/002_*.py, services/climate/tests/spatial/**
exit: `uv run --group derive python -m climate.spatial.derive` regenerates derived.json byte-identically from cached responses; `uv run pytest tests/spatial tests/db -q` green; no display name matches the §A.1 guard
phase: done
blocked:
created: 2026-09-24T0330Z
sprint: S-002
issue: 46
---

## Plan
Spec §A.1–§A.4. Rename 12 heat cells (#55); derive.py (Open-Meteo Elevation stencil, WorldCover 2 km windows via rasterio, OSM commune + road density via Overpass with UA + retry); derived.json with per-unit values, bounds, mapping tables, provenance (source URL, version/licence, retrieval date, method params); catalogue.py loader (typed access, no network); migration 002 updates names + props; guard test over units + derived.

## Execute
Branch `feat/T-101-static-layers-v2` = origin/dev (bedecc2) + WIP 5bc2141 (clean cherry-pick) + c1c8bd3.
- `derive.py`: committed response cache `climate/spatial/derive_cache.json` (1.36 MB), keyed by
  request: elevation per "lat,lng" → z; WorldCover per window bounds → class histogram; Overpass per
  query text → {timestamp_osm_base, elements[id, name?, geometry?]}. Retrieval date per source lives
  in the cache, so provenance `retrieved` is stable. Cached keys are never refetched; rasterio is
  imported only for an uncached window. To re-derive from fresh data: delete the cache file.
  Retries now also cover non-JSON 200 bodies and Overpass `remark` (partial answer).
- Migration 002: renames only (up: 12 toponyms, down: legacy names). The WIP's props merge was
  dropped — it failed `tests/db/test_db_repo.py` (out of scope) and duplicated derived.json, which
  the spec says runtime reads as the committed file (via catalogue).
- `units.py`: former-name table removed from the runtime module; docstring no longer claims pdim
  already reads derived.json (that is T-103).
- Out-of-scope test edits forced by the renames (legacy parity.json keeps the old heat names):
  `tests/pdim/test_pdim_parity.py::test_heat` and `tests/worker/test_worker.py` expect units.py's
  name by id (3 and 3 lines).
- Tests: offline byte-identical replay from the committed cache (MockTransport that fails any
  request), migration 002 up/down/up on its own DB `ucdt_test_spatial`, fractions, catalogue join,
  legacy_catalogue T̃ inversion, §A.1 guard (spec regex verbatim + former names; communes per #57).

## Review
- WIP numbers were right: the networked re-derive produced a derived.json byte-identical to the
  WIP's. station-tanphu roadDensity 0.0 checked by hand: the only matching way within 1 km is
  Lũy Bán Bích (secondary), whose segment midpoints all lie > 1 km away — correct per §A.3.
- The folded `climate.ingest.names.is_admin_label` flags the real toponym "Lạc Long Quân"
  (quân → quan); fine for third-party station names (T-102's stated trade-off), wrong for unit
  names, so the unit guard uses the spec regex verbatim.
- Overpass is slow (many 429/504); the first full fetch took ~35 min. Irrelevant once cached.

## Test
```
$ uv run --group derive python -m climate.spatial.derive     # network, empty cache
wrote .../climate/spatial/derived.json                        # git diff vs WIP: none
$ HTTPS_PROXY=http://127.0.0.1:9 uv run --offline --group derive python -m climate.spatial.derive
exit=0
derived before E48C227A… after E48C227A…   cache before 072C0638… after 072C0638…
$ uv run ruff check . && uv run ruff format --check .
All checks passed!
50 files already formatted
$ uv run pytest tests/spatial tests/db -q
86 passed in 2.17s
$ uv run pytest -q
268 passed in 4.38s
```

## Handoff
Done pending lead review. For T-103: `climate.spatial.catalogue.load_catalogue()` (measured) and
`legacy_catalogue()` (legacy constants, T̃ == terrain exactly) are the inputs; spatial_units in the
DB carry names only, no static layers.
