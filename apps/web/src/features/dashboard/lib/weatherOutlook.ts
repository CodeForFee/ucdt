import type { WeatherCurrent, WeatherData, WeatherForecastItem } from "@/shared/types/weather";
import type { HistoryEntry } from "@/shared/types/history";

export interface WeatherOutlook {
  /** Which data the figures below come from — drives which i18n label the card shows. */
  kind: "history" | "forecast" | "none";
  tempDelta: number | null;
  rainValue: number | null;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * B-007: a real 24 h delta only when `/api/history` actually has data for this hazard
 * (checked via `useHistory`, oldest-first per shared/hooks/useHistory.ts). The legacy bug
 * rendered a hardcoded "+1.2°C vs yesterday" / "-5.3mm vs average" as if measured, with no
 * historical data behind it anywhere in the stack. When history is empty (still true today
 * — risk_snapshots has no `weather` hazard rows), fall back to the 6 h forecast outlook the
 * API already returns. Never fabricate a number either way.
 */
export function weatherOutlook(
  current: WeatherCurrent | undefined,
  forecast: WeatherForecastItem[] | undefined,
  history: HistoryEntry<WeatherData>[] | undefined,
): WeatherOutlook {
  if (current && history && history.length > 0) {
    const past = history[0]?.result?.current;
    if (past) {
      return {
        kind: "history",
        tempDelta: round1(current.temperature - past.temperature),
        rainValue: round1(current.rainfall - past.rainfall),
      };
    }
  }

  const next6h = (forecast ?? []).slice(0, 6);
  if (!current || next6h.length === 0) {
    return { kind: "none", tempDelta: null, rainValue: null };
  }

  const peak = Math.max(...next6h.map((f) => f.temperature));
  return {
    kind: "forecast",
    tempDelta: round1(peak - current.temperature),
    rainValue: round1(next6h.reduce((sum, f) => sum + f.rainfall, 0)),
  };
}
