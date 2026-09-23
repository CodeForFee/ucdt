import { aqiCode } from "./aqi";

export function formatTemperature(value: number, unit: "C" | "F" = "C"): string {
  if (unit === "F") return `${((value * 9) / 5 + 32).toFixed(1)}°F`;
  return `${value.toFixed(1)}°C`;
}

export function formatAQI(value: number): string {
  return value.toFixed(0);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatRiskScore(value: number): string {
  return (value * 100).toFixed(0);
}

/**
 * Date/time helpers take the active locale rather than hardcoding 'vi-VN', which used
 * to render Vietnamese dates in the English build. Call sites should pass the locale
 * from useLocaleStore.
 */
type Loc = "vi" | "en";
const intlLocale = (l: Loc = "vi") => (l === "en" ? "en-GB" : "vi-VN");

export function formatDate(date: string | Date, locale: Loc = "vi"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTime(date: string | Date, locale: Loc = "vi"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(date: string | Date, locale: Loc = "vi"): string {
  return `${formatDate(date, locale)} ${formatTime(date, locale)}`;
}

export function formatWindSpeed(mps: number): string {
  return `${mps.toFixed(1)} m/s`;
}

export function formatRainfall(mm: number): string {
  return `${mm.toFixed(1)} mm`;
}

export function formatHumidity(pct: number): string {
  return `${pct.toFixed(0)}%`;
}

/**
 * @deprecated Returns a locale-independent band code, not a label. Pass it through
 * useTranslations('aqi') at the call site — this function used to return hardcoded
 * Vietnamese, which rendered in the English build too.
 */
export function getAQILabel(aqi: number): string {
  return aqiCode(aqi);
}
