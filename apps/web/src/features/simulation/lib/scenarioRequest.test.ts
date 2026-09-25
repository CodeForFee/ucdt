import { describe, it, expect } from "vitest";
import { buildScenarioBody, buildScenarioRequest, greenDeltaPp } from "./scenarioRequest";
import type { SimulationParams } from "@/shared/types/simulation";

// Served baselines (§C): ρ₀ = 0.708, G₀ = 21.8 % — deliberately NOT the legacy 0.8 / 30 %.
const BASELINES = { density: 0.708, greenPct: 21.8 };

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

describe("greenDeltaPp (ΔG = G_sim − G₀, §C/§G)", () => {
  it("measures ΔG against the served G₀, not a hard-coded 30 %", () => {
    expect(greenDeltaPp(0.5, BASELINES)).toBe(28.2);
    expect(greenDeltaPp(0.3, BASELINES)).toBe(8.2); // the legacy code sent 0 here
  });

  it("an untouched slider (or no baseline yet) sends ΔG = 0", () => {
    expect(greenDeltaPp(undefined, BASELINES)).toBe(0);
    expect(greenDeltaPp(0.5, undefined)).toBe(0);
  });
});

describe("buildScenarioBody", () => {
  it("B-004: carries urbanDensity for the heat scenario once the slider is set", () => {
    expect(buildScenarioBody("heat", BASE_PARAMS, BASELINES).urbanDensity).toBe(0.9);
  });

  it("omits urbanDensity when untouched: the API scores it at the served ρ₀ (no 0.8 fallback)", () => {
    const body = buildScenarioBody("heat", { ...BASE_PARAMS, urbanDensity: undefined }, BASELINES);
    expect("urbanDensity" in body).toBe(false);
  });

  it("flood scenario carries rainfall + ΔG but no urbanDensity", () => {
    const body = buildScenarioBody("flood", BASE_PARAMS, BASELINES);
    expect(body.rainfallIncrease).toBe(50);
    expect(body.addGreenCoverage).toBe(28.2);
    expect(body.trafficReduction).toBe(20);
    expect(body.urbanDensity).toBeUndefined();
  });

  it("aqi scenario carries traffic reduction and rainfall wash, no urbanDensity", () => {
    const body = buildScenarioBody("aqi", BASE_PARAMS, BASELINES);
    expect(body.trafficReduction).toBe(20);
    expect(body.rainfallIncrease).toBe(50);
    expect(body.urbanDensity).toBeUndefined();
  });
});

describe("buildScenarioRequest", () => {
  it("wraps the scenario body with the city id", () => {
    expect(buildScenarioRequest("heat", "hcmc", BASE_PARAMS, BASELINES)).toEqual({
      cityId: "hcmc",
      scenario: {
        rainfallIncrease: 0,
        rainfallDurationHours: 0,
        addGreenCoverage: 28.2,
        trafficReduction: 0,
        urbanDensity: 0.9,
      },
    });
  });
});
