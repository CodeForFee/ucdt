import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `GET /api/alerts` — per-unit alerts (§F); there is no "system" alert any more. */
export type AlertsResponse = S["AlertsResponse"];
export type Alert = S["Alert"];
