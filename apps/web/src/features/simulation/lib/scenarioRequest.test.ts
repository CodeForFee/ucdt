import { describe, it, expect } from "vitest";
import { buildScenarioBody, buildScenarioRequest } from "./scenarioRequest";
import type { SimulationParams } from "@/shared/types/simulation";

const BASE_PARAMS: SimulationParams = {
  preset: "baseline",
  rainfallMultiplier: 1.5,
  trafficReduction: 20,
  greenCoverage: 0.5,
  urbanDensity: 0.9,
  enable3D: true,
  showBuildings: true,
  city: "hcmc",
};

describe("buildScenarioBody", () => {
  it("B-004: always carries urbanDensity for the heat scenario", () => {
    const body = buildScenarioBody("heat", BASE_PARAMS);
    expect(body.urbanDensity).toBe(0.9);
  });

  it("falls back to the baseline density (0.8) when urbanDensity is unset", () => {
    const body = buildScenarioBody("heat", { ...BASE_PARAMS, urbanDensity: undefined });
    expect(body.urbanDensity).toBe(0.8);
  });

  it("flood scenario carries rainfall + green coverage but no urbanDensity", () => {
    const body = buildScenarioBody("flood", BASE_PARAMS);
    expect(body.rainfallIncrease).toBe(50);
    expect(body.addGreenCoverage).toBe(20);
    expect(body.trafficReduction).toBe(20);
    expect(body.urbanDensity).toBeUndefined();
  });

  it("aqi scenario carries traffic reduction and rainfall wash, no urbanDensity", () => {
    const body = buildScenarioBody("aqi", BASE_PARAMS);
    expect(body.trafficReduction).toBe(20);
    expect(body.rainfallIncrease).toBe(50);
    expect(body.urbanDensity).toBeUndefined();
  });
});

describe("buildScenarioRequest", () => {
  it("wraps the scenario body with the city id", () => {
    const req = buildScenarioRequest("heat", "hcmc", BASE_PARAMS);
    expect(req).toEqual({
      cityId: "hcmc",
      scenario: {
        rainfallIncrease: 0,
        rainfallDurationHours: 0,
        addGreenCoverage: 20,
        trafficReduction: 0,
        urbanDensity: 0.9,
      },
    });
  });
});
