import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `POST /api/simulation/run` body. Omitted `urbanDensity` = the served baseline ρ₀. */
export type SimulationRequest = S["SimulationRequest"];
export type Scenario = S["Scenario"];

/** Algorithm 2 step 7 (§G): results + `counterfactual` {recommendations, alerts, bandChanges}. */
export type SimulationResult = S["SimulationResult"];
export type SimStation = S["SimStation"];
export type Counterfactual = S["Counterfactual"];
export type BandChange = S["BandChange"];
export type SimAlert = S["SimAlert"];

/** UI slider state (not a payload). `greenCoverage` (0–1) and `urbanDensity` (0–1) stay
 *  undefined until the user moves them: the sliders then sit at the served G₀ / ρ₀ (§C). */
export interface SimulationParams {
  preset: string;
  rainfallMultiplier: number;
  trafficReduction: number;
  greenCoverage?: number;
  urbanDensity?: number;
  enable3D: boolean;
  showBuildings: boolean;
  city: string;
}
