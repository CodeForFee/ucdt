import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `GET /api/maturity` — Algorithm 1 per hazard (§H). */
export type MaturityResponse = S["MaturityResponse"];
export type HazardMaturity = S["HazardMaturity"];
export type MaturityStage = S["Stage"];
export type GammaEstimate = S["GammaEstimate"];
