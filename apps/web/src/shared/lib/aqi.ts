/**
 * US AQI bands — the single source for every breakpoint, colour and label in the UI.
 *
 * These bounds mirror the backend's AQI_CATEGORIES table. Previously re-declared in ten
 * different components, each with its own hex codes, which is how a legend and a marker
 * end up disagreeing about where "unhealthy" starts.
 *
 * `code` is stable and locale-independent; the human label comes from i18n (`aqi.*`
 * namespace), never from here.
 */
export type AQICode =
  | "good"
  | "moderate"
  | "unhealthySensitive"
  | "unhealthy"
  | "veryUnhealthy"
  | "hazardous";

export interface AQIBand {
  /** Inclusive upper bound of the band. */
  max: number;
  code: AQICode;
  /** EPA reference colour for the band. */
  color: string;
}

export const AQI_BANDS: readonly AQIBand[] = [
  { max: 50, code: "good", color: "#009966" },
  { max: 100, code: "moderate", color: "#ffde33" },
  { max: 150, code: "unhealthySensitive", color: "#ff9933" },
  { max: 200, code: "unhealthy", color: "#cc0033" },
  { max: 300, code: "veryUnhealthy", color: "#660099" },
  { max: Number.POSITIVE_INFINITY, code: "hazardous", color: "#7e0023" },
] as const;

/** The band a value falls in. Never returns undefined. */
export function aqiBand(aqi: number): AQIBand {
  return AQI_BANDS.find((b) => aqi <= b.max) ?? AQI_BANDS[AQI_BANDS.length - 1];
}

export function aqiCode(aqi: number): AQICode {
  return aqiBand(aqi).code;
}

export function aqiColor(aqi: number): string {
  return aqiBand(aqi).color;
}

/**
 * Breakpoints as a flat list, for Mapbox `step` expressions and legends that need the
 * boundaries rather than the band.
 */
export const AQI_BREAKPOINTS = AQI_BANDS.slice(0, -1).map((b) => b.max);
