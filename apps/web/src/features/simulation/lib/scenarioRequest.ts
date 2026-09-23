import type { SimulationParams, SimulationRequest } from "@/shared/types/simulation";

export type ScenarioKind = "flood" | "heat" | "aqi";

/**
 * Builds the POST /api/simulation body for each scenario tab from the shared slider
 * state. Pulled out as a pure function (no store/query reads) so it is unit-testable
 * without mounting a component — see scenarioRequest.test.ts.
 *
 * B-004: the heat scenario must always carry `urbanDensity`, or the backend's UHI term
 * of tempDelta is identically zero and the slider does nothing.
 */
export function buildScenarioBody(
  scenario: ScenarioKind,
  params: SimulationParams,
): SimulationRequest["scenario"] {
  // BE reads addGreenCoverage as the % of green cover ADDED on top of the 30% baseline.
  const addGreenCoverage = Math.round((params.greenCoverage - 0.3) * 100);

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
        urbanDensity: params.urbanDensity ?? 0.8,
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
): SimulationRequest {
  return { cityId, scenario: buildScenarioBody(scenario, params) };
}
