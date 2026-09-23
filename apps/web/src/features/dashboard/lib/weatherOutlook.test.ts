import { describe, it, expect } from "vitest";
import { weatherOutlook } from "./weatherOutlook";
import type { WeatherCurrent, WeatherData, WeatherForecastItem } from "@/shared/types/weather";
import type { HistoryEntry } from "@/shared/types/history";

const current: WeatherCurrent = {
  temperature: 30,
  feelsLike: 33,
  humidity: 70,
  rainfall: 2,
  windSpeed: 3,
  windDirection: 180,
  condition: "cloudy",
  timestamp: "2026-09-24T00:00:00Z",
};

const forecast: WeatherForecastItem[] = [
  { hour: "01:00", temperature: 31, rainfall: 1, stormProbability: 0 },
  { hour: "02:00", temperature: 32, rainfall: 1.5, stormProbability: 0 },
];

describe("weatherOutlook (B-007)", () => {
  it("falls back to the 6h forecast outlook when history is empty — never a hardcoded number", () => {
    const outlook = weatherOutlook(current, forecast, []);
    expect(outlook.kind).toBe("forecast");
    expect(outlook.tempDelta).toBeCloseTo(32 - 30, 5); // peak - current
    expect(outlook.rainValue).toBeCloseTo(1 + 1.5, 5);
  });

  it("falls back to the forecast outlook when history is undefined", () => {
    const outlook = weatherOutlook(current, forecast, undefined);
    expect(outlook.kind).toBe("forecast");
  });

  it("uses the real 24h delta only once /api/history actually returns data", () => {
    const past: HistoryEntry<WeatherData>[] = [
      {
        computedAt: "2026-09-23T00:00:00Z",
        result: { current: { ...current, temperature: 27, rainfall: 5 }, forecast: [] },
      },
    ];

    const outlook = weatherOutlook(current, forecast, past);
    expect(outlook.kind).toBe("history");
    expect(outlook.tempDelta).toBeCloseTo(30 - 27, 5);
    expect(outlook.rainValue).toBeCloseTo(2 - 5, 5);
  });

  it("reports 'none' rather than fabricating a number when nothing is available", () => {
    const outlook = weatherOutlook(undefined, [], []);
    expect(outlook).toEqual({ kind: "none", tempDelta: null, rainValue: null });
  });
});
