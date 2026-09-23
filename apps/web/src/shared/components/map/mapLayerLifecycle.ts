import type { Map as MapboxMap } from "mapbox-gl";

interface MapboxInternal {
  _removed?: boolean;
  style?: unknown;
}

/** Whether the map is alive and its style can still be operated on. */
export function isMapUsable(map: MapboxMap | null | undefined): map is MapboxMap {
  const m = map as unknown as MapboxInternal | undefined;
  return !!map && !m?._removed && !!m?.style;
}

/**
 * Runs `setup` once the style is ready: immediately if already loaded, otherwise waits
 * for the map's next 'idle' (not 'styledata' — that fires continuously as tiles arrive,
 * which risks adding a layer mid style-switch). Returns a cancel function: removes the
 * listener and disarms a setup that hasn't run yet.
 */
export function whenStyleReady(map: MapboxMap, setup: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (cancelled || !isMapUsable(map)) return;
    setup();
  };
  let styleLoaded = false;
  try {
    styleLoaded = map.isStyleLoaded();
  } catch {
    /* not ready */
  }
  if (styleLoaded) {
    run();
  } else {
    map.once("idle", run);
  }
  return () => {
    cancelled = true;
    try {
      map.off("idle", run);
    } catch {
      /* map already torn down */
    }
  };
}

/**
 * Removes layers before their source, each step individually guarded so one failure
 * doesn't skip the rest — an orphaned layer still pointing at a removed source is what
 * crashes mapbox-gl's placement pass with "reading 'get'".
 */
export function removeLayersAndSource(
  map: MapboxMap,
  layerIds: string[],
  sourceId?: string,
): void {
  if (!isMapUsable(map)) return;
  for (const id of layerIds) {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
    } catch {
      /* already gone */
    }
  }
  if (sourceId) {
    try {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch {
      /* already gone */
    }
  }
}
