import { describe, it, expect } from "vitest";
import { decomposeFloodRisk } from "./decomposeFloodRisk";
import type { FloodTriggers } from "@/shared/types/flood";

describe("decomposeFloodRisk", () => {
  it("sums the four weighted terms back to R_f = w1*P + w2*T + w3*I - w4*D (B-011)", () => {
    const triggers: FloodTriggers = {
      currentRainfall: 25, // P̃ = 25/50 = 0.5
      terrainSensitivity: 0.6, // T̃
      soilSaturation: 0.7, // Ĩ
      drainageCapacity: 0.4, // D̃
    };

    const { terms, sum } = decomposeFloodRisk(triggers);

    expect(terms).toHaveLength(4);
    const expected = 0.45 * 0.5 + 0.3 * 0.6 + 0.25 * 0.7 - 0.15 * 0.4;
    expect(sum).toBeCloseTo(expected, 9);

    const drainageTerm = terms.find((t) => t.key === "drainage")!;
    expect(drainageTerm.contribution).toBeLessThan(0); // the SUBTRACTIVE term (B-010)
  });

  it("clamps each normalized input to [0, 1] even when a trigger is out of range", () => {
    const triggers: FloodTriggers = {
      currentRainfall: 500, // far above rainRefMmH=50 -> P̃ clamps to 1
      terrainSensitivity: 1.5,
      soilSaturation: -0.2,
      drainageCapacity: 2,
    };

    const { sum } = decomposeFloodRisk(triggers);
    // w1*1 + w2*1 + w3*0 - w4*1
    expect(sum).toBeCloseTo(0.45 + 0.3 + 0 - 0.15, 9);
  });
});
