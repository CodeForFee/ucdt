import { useEffect } from "react";
import type { Map as MapboxMap, MapSourceDataEvent } from "mapbox-gl";
import { MAP3D_CONFIG } from "@/shared/lib/map3DConfig";
import { isMapUsable, whenStyleReady } from "@/shared/components/map/mapLayerLifecycle";

interface TerrainLayerProps {
  map: MapboxMap;
  exaggeration?: number;
}

const SOURCE_ID = "mapbox-dem";

export function TerrainLayer({ map, exaggeration = MAP3D_CONFIG.terrainExaggeration }: TerrainLayerProps) {
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let offSourceData: (() => void) | null = null;

    function applyTerrain() {
      if (cancelled || !isMapUsable(map)) return;
      try {
        map.setTerrain({ source: SOURCE_ID, exaggeration });
      } catch {
        /* map torn down mid-flight */
      }
    }

    const cancelSetup = whenStyleReady(map, () => {
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
        }
      } catch {
        return;
      }

      // Listen for the DEM source to finish loading, then setTerrain
      const onSourceData = (e: MapSourceDataEvent) => {
        if (e.sourceId !== SOURCE_ID || !e.isSourceLoaded) return;
        map.off("sourcedata", onSourceData);
        clearTimeout(timer);
        applyTerrain();
      };
      map.on("sourcedata", onSourceData);
      offSourceData = () => {
        try {
          map.off("sourcedata", onSourceData);
        } catch {
          /* map torn down */
        }
      };

      // Fallback: if sourcedata never fires (already cached), apply after a short delay
      timer = setTimeout(() => {
        map.off("sourcedata", onSourceData);
        applyTerrain();
      }, 800);
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelSetup();
      offSourceData?.();
      if (!isMapUsable(map)) return;
      try {
        map.setTerrain(null);
      } catch {
        /* map torn down */
      }
      try {
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* map torn down */
      }
    };
  }, [map, exaggeration]);

  return null;
}
