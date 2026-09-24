import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { ComparePanel } from "./ComparePanel";
import messages from "@/messages/vi.json";
import type { SimulationResult } from "@/shared/types/simulation";
import { simulation } from "@/test/fixtures";

// S-002 removed the legacy heuristic fields from the API (B-016). A payload that still
// carried them (an old gateway) must not leak them either; distinctive values make it obvious.
const result = {
  ...simulation,
  results: { ...simulation.results, affectedBuildings: 21_600, affectedPopulation: 1_140_000 },
} as SimulationResult;

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
