/**
 * Central TanStack Query key registry.
 *
 * Keys are built here rather than inline at each call site so an invalidation cannot
 * silently miss a cache entry because two files spelled the key differently — this is
 * also what useLiveEvents.ts invalidates against on a `snapshot.updated`/`alert.created`
 * SSE event.
 */
export const KEY = {
  weather: "weather",
  aqi: "aqi",
  flood: "flood",
  heat: "heat",
  recommend: "recommend",
  alerts: "alerts",
} as const;

export const QUERY_KEY = {
  weather: (cityId: string) => [KEY.weather, cityId] as const,
  aqi: (cityId: string) => [KEY.aqi, cityId] as const,
  flood: (cityId: string) => [KEY.flood, cityId] as const,
  heat: (cityId: string) => [KEY.heat, cityId] as const,
  recommend: (cityId: string) => [KEY.recommend, cityId] as const,
  alerts: (cityId: string) => [KEY.alerts, cityId] as const,
} as const;
