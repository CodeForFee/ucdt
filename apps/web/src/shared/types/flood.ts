import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `GET /api/flood` — generated from the climate OpenAPI (packages/contracts). */
export type FloodData = S["FloodLatest"];
export type FloodArea = S["FloodArea"];
export type FloodTriggers = S["FloodTriggers"];
/** One served R_f term (§B, B-014): the web renders these and holds no PDIM weight. */
export type FloodTerm = S["FloodTerm"];
export type FloodGeoJSONFeature = S["FloodGeoJSONFeature"];
