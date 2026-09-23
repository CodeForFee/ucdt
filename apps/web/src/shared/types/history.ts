/** One point of `GET /api/history/:hazard`. `result` mirrors that hazard's own response
 *  shape (FloodData, HeatData, AQIData, ...) as it was at `computedAt`. */
export interface HistoryEntry<T = unknown> {
  computedAt: string;
  result: T;
}
