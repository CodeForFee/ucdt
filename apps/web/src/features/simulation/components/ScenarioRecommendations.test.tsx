import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import { ScenarioRecommendations } from "./ScenarioRecommendations";
import { simulation } from "@/test/fixtures";

function renderIt(showStations = false) {
  return render(
    <IntlProvider locale="vi" messages={messages}>
      <ScenarioRecommendations result={simulation} showStations={showStations} />
    </IntlProvider>,
  );
}

describe("ScenarioRecommendations (counterfactual, §G/§J)", () => {
  it("renders nothing before a run", () => {
    const { container } = render(
      <IntlProvider locale="vi" messages={messages}>
        <ScenarioRecommendations result={undefined} />
      </IntlProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the counterfactual top-k ranked by toponym, without exposing the internal rule/score", () => {
    const { container } = renderIt();
    expect(screen.getByRole("heading", { name: "Khuyến nghị cho kịch bản" })).toBeInTheDocument();
    expect(container.textContent).toContain("Top 2 / 9");
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Rạch Ông");
    expect(items[0]).not.toContain("R-COMB-01");
    expect(items[0]).not.toContain("π");
  });

  it("shows band changes before → after per unit, and the alerts that would fire", () => {
    const { container } = renderIt();
    const text = container.textContent ?? "";
    expect(text).toContain("Trung bình → Nguy hiểm"); // flood, Rạch Ông
    expect(text).toContain("Vừa → Thấp"); // heat, Đinh Bộ Lĩnh
    expect(text).toContain("Ngập nghiêm trọng tại Rạch Ông");
    expect(text).toContain("Nghiêm trọng");
  });

  it("shows the served per-point AQI before → after only when asked (AQI simulator)", () => {
    expect(renderIt(false).container.textContent).not.toContain("AQI theo điểm");
    const text = renderIt(true).container.textContent ?? "";
    expect(text).toContain("AQI theo điểm (trước → sau)");
    expect(text).toContain("41 → 33");
    expect(text).toContain("-8");
  });
});
