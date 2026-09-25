import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `GET /api/heat` — generated from the climate OpenAPI (packages/contracts). */
export type HeatData = S["HeatLatest"];
export type HeatHotspot = S["HeatHotspot"];
/** ρ₀ (0–1) and G₀ (%) — the what-if reference state; the heat sliders start here (§C). */
export type HeatBaselines = S["HeatBaselines"];
