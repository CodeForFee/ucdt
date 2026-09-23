import type { FeatureCollection } from "geojson";
import type { HeatHotspot } from "@/shared/types/heat";

/**
 * B-006: the map must show ONLY the backend's tempDelta — never blend local slider
 * drift onto it (that broke DP3: the map showed a number the processing layer never
 * computed). There is no client-side PDIM port in this app (unlike legacy's
 * shared/lib/pdim.ts), so `tempDelta` is either the backend's own number from a
 * completed POST /api/simulation, or exactly 0 before one has landed — never a locally
 * recomputed estimate.
 */
export function buildHeatGeojson(
  hotspots: HeatHotspot[],
  tempDelta: number | null | undefined,
): FeatureCollection {
  const delta = tempDelta ?? 0;

  return {
    type: "FeatureCollection",
    features: hotspots.map((h) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [h.lng, h.lat] },
      properties: {
        name: h.name ?? "",
        intensity: Math.max(0, Math.min(1, (h.intensity ?? 0.5) + delta * 0.02)),
        temp: Math.round((h.temperature + delta) * 10) / 10,
      },
    })),
  };
}
