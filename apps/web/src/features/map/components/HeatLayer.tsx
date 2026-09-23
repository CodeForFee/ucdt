import { useEffect } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import { useHeatMap } from "@/shared/hooks/useHeatMap";
import { useMapStore } from "@/shared/stores/mapStore";
import { removeLayersAndSource } from "@/shared/components/map/mapLayerLifecycle";

interface HeatLayerProps {
  map: MapboxMap;
}

const SOURCE_ID = "heat-source";
const LAYER_ID = "heat-heatmap";

export function HeatLayer({ map }: HeatLayerProps) {
  const { data } = useHeatMap();
  const { activeLayers } = useMapStore();
  const isActive = activeLayers.includes("heat");

  useEffect(() => {
    if (!map || !data?.geojson) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: data.geojson as unknown as FeatureCollection });
    } else {
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data.geojson as unknown as FeatureCollection);
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "heatmap",
        source: SOURCE_ID,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "intensity"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 14, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.2,
            "#fef9c3",
            0.4,
            "#fde047",
            0.6,
            "#f97316",
            0.8,
            "#ef4444",
            1,
            "#b91c1c",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 20, 14, 60],
          "heatmap-opacity": 0.75,
        },
      });
    }

    return () => {
      removeLayersAndSource(map, [LAYER_ID], SOURCE_ID);
    };
  }, [map, data]);

  useEffect(() => {
    if (!map) return;
    if (map.getLayer(LAYER_ID)) {
      map.setLayoutProperty(LAYER_ID, "visibility", isActive ? "visible" : "none");
    }
  }, [map, isActive]);

  return null;
}
