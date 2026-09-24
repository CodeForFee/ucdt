import type { components } from "@ucdt/contracts";

type S = components["schemas"];

// Rule-based (§E): π(r, i) = S(b)·E(i)·F(a) is computed by climate, never here.
/** `GET /api/recommend` — top k = 10 per-unit items + `firedCount`. */
export type RecommendData = S["RecommendLatest"];
/** `commune` is data/API only (§A.3) — it is never rendered. */
export type Recommendation = S["Recommendation"];
export type RecommendationInputs = S["RecommendationInputs"];
