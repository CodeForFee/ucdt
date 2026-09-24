import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import { ObservedStationsList } from "./AirQualityPage";
import { aqi } from "@/test/fixtures";

function renderIt(data = aqi) {
  return render(
    <IntlProvider locale="vi" messages={messages}>
      <ObservedStationsList data={data} />
    </IntlProvider>,
  );
}

describe("ObservedStationsList (AirGradient, §I.3/§J)", () => {
  it("lists each open-network station with its AQI, PM2.5 and nearest CAMS point by toponym", () => {
    renderIt();
    expect(screen.getByText("Trạm quan trắc (AirGradient)")).toBeInTheDocument();
    expect(screen.getByText("CMT8")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).toContain("PM2.5 8.8 µg/m³");
    expect(text).toContain("Điểm CAMS gần nhất: Ba Tháng Hai");
    expect(text).not.toContain("station-q10");
  });

  it("says so when no station reported recently", () => {
    renderIt({ ...aqi, observedStations: [] });
    expect(screen.getByText("Chưa có trạm nào báo cáo trong 2 giờ qua")).toBeInTheDocument();
  });
});
