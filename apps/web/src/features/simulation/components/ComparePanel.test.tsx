import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { ComparePanel } from "./ComparePanel";
import messages from "@/messages/vi.json";
import type { SimulationResult } from "@/shared/types/simulation";

// The API keeps the legacy heuristic fields (50k/80k people, 1,200 buildings per zone).
// Distinctive values make any leak onto the screen obvious.
const result: SimulationResult = {
  simulationId: "sim-1-1",
  status: "completed",
  results: {
    floodRiskDelta: 0.12,
    newFloodAreas: [],
    tempDelta: -1.5,
    aqiDelta: -6,
    affectedBuildings: 21_600,
    affectedPopulation: 1_140_000,
  },
  comparison: {
    before: { riskScore: 0.4, affectedAreas: 12 },
    after: { riskScore: 0.52, affectedAreas: 18 },
  },
};

describe("ComparePanel (B-016)", () => {
  it.each(["flood", "heat", "aqi"] as const)(
    "never renders the heuristic population/buildings as measured values (%s)",
    (scenario) => {
      const { container } = render(
        <IntlProvider locale="vi" messages={messages}>
          <ComparePanel scenario={scenario} result={result} />
        </IntlProvider>,
      );
      const text = container.textContent ?? "";
      expect(screen.getByText("Kết quả mô phỏng")).toBeInTheDocument();
      expect(text).not.toMatch(/Dân số|Tòa nhà/);
      expect(text).not.toContain((1_140_000).toLocaleString());
      expect(text).not.toContain((21_600).toLocaleString());
    },
  );
});
