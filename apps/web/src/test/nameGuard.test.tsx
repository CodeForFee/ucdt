/**
 * Spec §A.1/§A.3/§J: no administrative name anywhere in the UI. Renders the dashboard, the
 * flood page, the recommendations tab, the header alerts dropdown and the three simulator
 * sidebars (with their "Khuyến nghị cho kịch bản" panels) on realistic contract-typed payloads whose `commune`
 * fields DO carry "Phường Bình Thạnh" / "Xã Nhà Bè" — and asserts none of it reaches the text.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { IntlProvider } from "use-intl";
import vi_ from "@/messages/vi.json";
import en from "@/messages/en.json";
import * as fx from "@/test/fixtures";
import { useAlertStore } from "@/shared/stores/alertStore";
import { useSimulationStore } from "@/shared/stores/simulationStore";

const q = <T,>(data: T) => () => ({ data, isLoading: false, isError: false, refetch: () => {} });
vi.mock("@/shared/hooks/useWeatherData", () => ({ useWeatherData: q(fx.weather) }));
vi.mock("@/shared/hooks/useHistory", () => ({ useHistory: q([]) }));
vi.mock("@/shared/hooks/useAQIData", () => ({ useAQIData: q(fx.aqi) }));
vi.mock("@/shared/hooks/useFloodRisk", () => ({ useFloodRisk: q(fx.flood) }));
vi.mock("@/shared/hooks/useHeatMap", () => ({ useHeatMap: q(fx.heat) }));
vi.mock("@/shared/hooks/useRecommend", () => ({ useRecommend: q(fx.recommend) }));
vi.mock("@/shared/hooks/useAlerts", () => ({ useAlerts: q(fx.alerts) }));
vi.mock("@/shared/hooks/useMaturity", () => ({ useMaturity: q(fx.maturity) }));
vi.mock("@/shared/hooks/useUnits", () => ({ useUnitNames: q(new Map(fx.units.map((u) => [u.id, u.name]))) }));
// recharts' ResponsiveContainer needs a layout engine jsdom lacks; the chart only draws
// hourly temperature/rain numbers, no names.
vi.mock("@/features/dashboard/components/WeatherTrendChart", () => ({ WeatherTrendChart: () => null }));

const { default: DashboardPage } = await import("@/features/dashboard/pages/DashboardPage");
const { default: FloodPage } = await import("@/features/flood/pages/FloodPage");
const { ObservedStationsList } = await import("@/features/air-quality/pages/AirQualityPage");
const { FloodSidebar } = await import("@/features/simulation/components/flood/FloodSidebar");
const { HeatSidebar } = await import("@/features/simulation/components/heat/HeatSidebar");
const { AQISidebar } = await import("@/features/simulation/components/aqi/AQISidebar");
const { default: RecommendationsPage } = await import("@/features/recommendations/pages/RecommendationsPage");
const { AlertsBell } = await import("@/shared/components/layout/AlertsBell");

/** The bell's dropdown, opened. */
function OpenBell() {
  return (
    <div
      ref={(el) => {
        const button = el?.querySelector("button");
        if (button && button.getAttribute("aria-expanded") === "false") fireEvent.click(button);
      }}
    >
      <AlertsBell />
    </div>
  );
}

const ADMIN = /Quận|Huyện|District|Phường|Xã|\bQ\.\s?\d/;
const FORMER_DISTRICTS = [
  "Bình Thạnh",
  "Phú Nhuận",
  "Tân Bình",
  "Tân Phú",
  "Gò Vấp",
  "Bình Tân",
  "Thủ Đức",
  "Bình Chánh",
  "Hóc Môn",
  "Nhà Bè",
  "Cần Giờ",
  "Củ Chi",
];

const sidebarProps = { result: fx.simulation, isPending: false, onRun: () => {}, onReset: () => {} };
const SCREENS: Array<[string, () => React.ReactElement]> = [
  ["dashboard", () => <DashboardPage />],
  ["recommendations tab", () => <RecommendationsPage />],
  ["alerts dropdown", () => <OpenBell />],
  ["flood page", () => <FloodPage />],
  ["observed stations", () => <ObservedStationsList data={fx.aqi} />],
  ["flood simulator", () => <FloodSidebar {...sidebarProps} />],
  ["heat simulator", () => <HeatSidebar {...sidebarProps} />],
  ["aqi simulator", () => <AQISidebar {...sidebarProps} />],
];

function textOf(ui: React.ReactElement, locale: "vi" | "en") {
  const { container, unmount } = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <IntlProvider locale={locale} messages={locale === "vi" ? vi_ : en}>
          {ui}
        </IntlProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const text = container.textContent ?? "";
  unmount();
  return text;
}

describe("no administrative names in the UI (§A.1, §A.3, §J)", () => {
  beforeEach(() => {
    useAlertStore.getState().setAlerts(fx.alerts.alerts);
    useSimulationStore.getState().resetSimulation();
  });

  it("the fixtures really carry commune names, so the guard is not vacuous", () => {
    const communes = [...fx.recommendations, ...fx.units].map((r) => r.commune).join(" ");
    expect(communes).toMatch(ADMIN);
    expect(communes).toContain("Bình Thạnh");
  });

  it.each(SCREENS.flatMap(([name, ui]) => (["vi", "en"] as const).map((l) => [`${name} (${l})`, ui, l] as const)))(
    "%s",
    (_name, ui, locale) => {
      const text = textOf(ui(), locale);
      expect(text.length).toBeGreaterThan(50); // it did render
      expect(text).not.toMatch(ADMIN);
      for (const name of FORMER_DISTRICTS) expect(text).not.toContain(name);
    },
  );

  it("the screens do render the toponyms the payloads carry", () => {
    expect(textOf(<DashboardPage />, "vi")).toContain("Độ trưởng thành mô hình");
    const recs = textOf(<RecommendationsPage />, "vi");
    expect(recs).toContain("Ung Văn Khiêm");
    expect(recs).toContain("R-FLOOD-03");
    expect(recs).toContain("π = 3.23");
    const bell = textOf(<OpenBell />, "vi");
    expect(bell).toContain("Ung Văn Khiêm");
    expect(bell).toContain("Nguy cơ ngập tại Ung Văn Khiêm");
  });
});
