import { useEffect } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { AQI_COLORS } from "@/shared/lib/colorScales";
import { useMapStore } from "@/shared/stores/mapStore";
import { removeLayersAndSource } from "@/shared/components/map/mapLayerLifecycle";

interface AQILayerProps {
  map: MapboxMap;
}

const SOURCE_ID = "aqi-source";
const LAYER_ID = "aqi-circles";

export function AQILayer({ map }: AQILayerProps) {
  const { data } = useAQIData();
  const { activeLayers } = useMapStore();
  const isActive = activeLayers.includes("aqi");

  useEffect(() => {
    if (!map || !data?.stations) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: data.stations.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: { name: s.name, aqi: s.aqi, category: s.category },
      })),
    };

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
    } else {
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(geojson);
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "aqi"], 0, 8, 300, 20],
          "circle-color": [
            "step",
            ["get", "aqi"],
            AQI_COLORS.good,
            51,
            AQI_COLORS.moderate,
            101,
            AQI_COLORS.unhealthySensitive,
            151,
            AQI_COLORS.unhealthy,
            201,
            AQI_COLORS.veryUnhealthy,
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.4,
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
