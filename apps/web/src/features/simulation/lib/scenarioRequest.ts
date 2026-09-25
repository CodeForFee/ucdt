import type { HeatBaselines } from "@/shared/types/heat";
import type { Scenario, SimulationParams, SimulationRequest } from "@/shared/types/simulation";

export type ScenarioKind = "flood" | "heat" | "aqi";

/**
 * ΔG in percentage points, as the API reads `addGreenCoverage` ("percentage points vs
 * baseline", §C/§G): ΔG = G_sim − G₀ with G₀ the SERVED mean green cover (heat
 * `baselines.greenPct`, ESA WorldCover). An untouched slider, or no baseline yet, is ΔG = 0.
 * This is request construction only: ΔT, ΔAQI and D̃_sim are computed by climate.
 */
export function greenDeltaPp(greenCoverage: number | undefined, baselines: HeatBaselines | undefined): number {
  if (greenCoverage == null || !baselines) return 0;
  return Math.round((greenCoverage * 100 - baselines.greenPct) * 10) / 10;
}

/**
 * Builds the POST /api/simulation body for each scenario tab from the shared slider
 * state. Pure (no store/query reads) so it is unit-testable — see scenarioRequest.test.ts.
 *
 * B-004: the heat scenario carries `urbanDensity` once the user has moved the slider; an
 * untouched slider omits it, which the API scores at the served baseline ρ₀ (§C), so the
 * UHI term is exactly 0 there instead of being measured against a hard-coded 0.8.
 */
export function buildScenarioBody(
  scenario: ScenarioKind,
  params: SimulationParams,
  baselines?: HeatBaselines,
): Scenario {
  const addGreenCoverage = greenDeltaPp(params.greenCoverage, baselines);

  switch (scenario) {
    case "flood":
      return {
        rainfallIncrease: Math.round((params.rainfallMultiplier - 1) * 100),
        rainfallDurationHours: 3,
        addGreenCoverage,
        trafficReduction: params.trafficReduction,
      };
    case "heat":
      return {
        rainfallIncrease: 0,
        rainfallDurationHours: 0,
        addGreenCoverage,
        trafficReduction: 0,
        ...(params.urbanDensity != null && { urbanDensity: params.urbanDensity }),
      };
    case "aqi":
      return {
        rainfallIncrease: Math.round((params.rainfallMultiplier - 1) * 100),
        rainfallDurationHours: 0,
        addGreenCoverage,
        trafficReduction: params.trafficReduction,
      };
  }
}

export function buildScenarioRequest(
  scenario: ScenarioKind,
  cityId: string,
  params: SimulationParams,
  baselines?: HeatBaselines,
): SimulationRequest {
  return { cityId, scenario: buildScenarioBody(scenario, params, baselines) };
}
