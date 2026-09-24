import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `GET /api/aqi` — generated from the climate OpenAPI (packages/contracts). */
export type AQIData = S["AQILatest"];
export type AQIForecastItem = S["AQIForecastItem"];
/** A CAMS-gridded AQI point (one of the 23 units). */
export type AQIStation = S["AQIStation"];
/** An open-monitoring-network station (AirGradient, §I.3) — observed, not modelled. */
export type ObservedStation = S["ObservedStation"];
