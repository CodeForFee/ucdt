import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import { MaturityView } from "./MaturityCard";
import { maturity } from "@/test/fixtures";

function renderIt(data = maturity) {
  return render(
    <IntlProvider locale="vi" messages={messages}>
      <MaturityView data={data} />
    </IntlProvider>,
  );
}

describe("MaturityCard (Algorithm 1 line 8, §H)", () => {
  it("shows the active stage per hazard", () => {
    renderIt();
    for (const [hazard, active] of [["flood", "S1"], ["heat", "S1"], ["aqi", "S2"]] as const) {
      const row = screen.getByTestId(`maturity-${hazard}`);
      expect(row.querySelector('[aria-current="step"]')?.textContent).toBe(active);
    }
  });

  it("shows each stage's criteria as current / required, with the reason text", () => {
    renderIt();
    const flood = screen.getByTestId("maturity-flood");
    expect(within(flood).getByText("Chuỗi quan trắc ngập / mực nước")).toBeInTheDocument();
    expect(within(flood).getByText("0 / 1")).toBeInTheDocument();
    expect(within(flood).getByText("w₁…w₄ need an observed inundation / gauge series")).toBeInTheDocument();
    expect(within(flood).getByText("0 / 12")).toBeInTheDocument();

    const aqi = screen.getByTestId("maturity-aqi");
    expect(within(aqi).getByText("170 / 168")).toBeInTheDocument();
    expect(within(aqi).getByText("7.10 / 7")).toBeInTheDocument();
  });

  it("shows the S1 holdout MAE only where it exists, and S2 estimates with 95 % CI", () => {
    renderIt();
    const aqi = screen.getByTestId("maturity-aqi");
    expect(aqi.textContent).toContain("4.45 AQI");
    expect(aqi.textContent).toContain("γ_w = 0.062 [0.040, 0.084]");
    expect(aqi.textContent).toContain("γ_p = 0.131 [0.072, 0.190]");
    expect(aqi.textContent).toContain("2.10 AQI"); // S2 holdout MAE
    expect(screen.getByTestId("maturity-flood").textContent).not.toContain("MAE");
  });

  it("states δ and W", () => {
    const { container } = renderIt();
    expect(container.textContent).toContain("δ = 2 AQI · W = 14 ngày");
  });
});
