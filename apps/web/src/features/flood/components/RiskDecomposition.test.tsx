import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import { RiskDecomposition } from "./RiskDecomposition";
import type { FloodTerm } from "@/shared/types/flood";

// Weights deliberately unlike PDIM S1 (0.45/0.30/0.25/0.15): the component must render what
// is served (B-014), so a web-side copy of the weights would show the wrong numbers here.
const terms: FloodTerm[] = [
  { key: "rainfall", weight: 0.4, normalized: 0.5, contribution: 0.2 },
  { key: "terrain", weight: 0.35, normalized: 0.6, contribution: 0.21 },
  { key: "imperviousness", weight: 0.25, normalized: 0.4, contribution: 0.1 },
  { key: "drainage", weight: 0.2, normalized: 0.5, contribution: -0.1 },
];

function renderIt(score = 0.41) {
  return render(
    <IntlProvider locale="vi" messages={messages}>
      <RiskDecomposition terms={terms} score={score} rainfall={25} />
    </IntlProvider>,
  );
}

describe("RiskDecomposition (served terms, B-014)", () => {
  it("renders every served term with its weight and the spec labels", () => {
    renderIt();
    expect(screen.getByText("Cường độ mưa")).toBeInTheDocument();
    expect(screen.getByText("Độ nhạy địa hình (DEM)")).toBeInTheDocument();
    expect(screen.getByText("Độ không thấm (Sentinel/WorldCover)")).toBeInTheDocument();
    expect(screen.getByText("Năng lực thoát nước (hằng số chuyên gia)")).toBeInTheDocument();
    for (const w of ["0.40", "0.35", "0.25", "0.20"]) {
      expect(screen.getByText(new RegExp(`trọng số ${w}`))).toBeInTheDocument();
    }
  });

  it("draws drainage as the subtractive term, in the opposite direction", () => {
    renderIt();
    const drainage = screen.getByTestId("term-drainage");
    expect(within(drainage).getByText("0.100", { exact: false }).textContent).toBe("−0.100");
    expect(drainage.querySelector('[data-direction="left"]')).not.toBeNull();
    expect(drainage.querySelector('[data-direction="right"]')).toBeNull();
    for (const key of ["rainfall", "terrain", "imperviousness"]) {
      const row = screen.getByTestId(`term-${key}`);
      expect(row.querySelector('[data-direction="right"]')).not.toBeNull();
    }
  });

  it("sums the served contributions to R_f", () => {
    const { container } = renderIt();
    expect(container.textContent).toContain("0.410"); // 0.2 + 0.21 + 0.1 − 0.1
    expect(container.textContent).not.toContain("đã kẹp"); // sum equals the served score
  });
});
