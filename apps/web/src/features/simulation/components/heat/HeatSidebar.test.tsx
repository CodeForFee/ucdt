import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import type { HeatData } from "@/shared/types/heat";
import type { SimulationResult } from "@/shared/types/simulation";

// Air temperature and mean T_eff deliberately far apart, so the test sees which one is used.
const heat = {
  city: "hcmc",
  timestamp: "2026-09-24T02:00:00.000Z",
  avgTemperature: 27.7,
  maxTemperature: 35.5,
  heatIslandIntensity: 2.5,
  avgEffectiveTemperature: 34.6,
  hotspots: [
    { id: "q1", name: "Bến Nghé", lat: 10.7769, lng: 106.7009, temperature: 35.5, intensity: 0.97 },
    { id: "cangio", name: "Cần Giờ", lat: 10.412, lng: 106.952, temperature: 33.7, intensity: 0.12 },
  ],
  geojson: { type: "FeatureCollection", features: [] },
} satisfies HeatData;

let served: HeatData = heat;
vi.mock("@/shared/hooks/useHeatMap", () => ({ useHeatMap: () => ({ data: served }) }));

const { HeatSidebar } = await import("./HeatSidebar");

const result = {
  simulationId: "sim-1-1",
  status: "completed",
  results: { floodRiskDelta: 0, newFloodAreas: [], tempDelta: -1.5, aqiDelta: 0, affectedBuildings: 0, affectedPopulation: 0 },
  comparison: { before: { riskScore: 0, affectedAreas: 0 }, after: { riskScore: 0, affectedAreas: 0 } },
} as SimulationResult;

function renderSidebar() {
  return render(
    <IntlProvider locale="vi" messages={messages}>
      <HeatSidebar result={result} isPending={false} onRun={() => {}} onReset={() => {}} />
    </IntlProvider>,
  );
}

describe("HeatSidebar preview (B-020, manuscript §4.2)", () => {
  it("headlines mean T_eff and T_eff + ΔT, never the air temperature", () => {
    served = heat;
    const text = renderSidebar().container.textContent ?? "";
    expect(text).toContain("34.6°"); // baseline = served mean T_eff
    expect(text).toContain("33.1°"); // simulated = 34.6 + (−1.5)
    expect(text).not.toContain("27.7°"); // air temperature is a different quantity
    expect(text).toContain("T_eff = HI(T, RH) + ρ·3,5 °C");
  });

  it("waits for a snapshot carrying mean T_eff instead of falling back to air temperature", () => {
    served = { ...heat, avgEffectiveTemperature: null };
    const text = renderSidebar().container.textContent ?? "";
    expect(text).not.toContain("27.7°");
    expect(text).not.toContain("26.2°"); // 27.7 + (−1.5)
  });
});
