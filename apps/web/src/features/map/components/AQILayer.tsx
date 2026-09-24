import { useEffect } from "react";
import type { Map as MapboxMap, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { AQI_COLORS } from "@/shared/lib/colorScales";
import { useMapStore } from "@/shared/stores/mapStore";
import { removeLayersAndSource } from "@/shared/components/map/mapLayerLifecycle";

interface AQILayerProps {
  map: MapboxMap;
}

const SOURCE_ID = "aqi-source";
const LAYER_ID = "aqi-circles";
// Open-monitoring-network stations (AirGradient, §I.3, §J): measured, not modelled, so they
// get their own source and a distinct marker (small, dark ring) — see MapLegend.
const OBS_SOURCE_ID = "aqi-observed-source";
const OBS_LAYER_ID = "aqi-observed-circles";

const AQI_STEP: ExpressionSpecification = [
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
];

type Pt = { name: string; lat: number; lng: number; aqi: number };
const toGeojson = (points: Pt[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((s) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    properties: { name: s.name, aqi: s.aqi },
  })),
});

function upsertSource(map: MapboxMap, id: string, data: ReturnType<typeof toGeojson>) {
  if (!map.getSource(id)) map.addSource(id, { type: "geojson", data });
  else (map.getSource(id) as GeoJSONSource).setData(data);
}

export function AQILayer({ map }: AQILayerProps) {
  const { data } = useAQIData();
  const { activeLayers } = useMapStore();
  const isActive = activeLayers.includes("aqi");

  useEffect(() => {
    if (!map || !data?.stations) return;

    upsertSource(map, SOURCE_ID, toGeojson(data.stations));
    upsertSource(map, OBS_SOURCE_ID, toGeojson(data.observedStations ?? []));

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "aqi"], 0, 8, 300, 20],
          "circle-color": AQI_STEP,
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.4,
        },
      });
    }
    if (!map.getLayer(OBS_LAYER_ID)) {
      map.addLayer({
        id: OBS_LAYER_ID,
        type: "circle",
        source: OBS_SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": AQI_STEP,
          "circle-opacity": 1,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#0f172a",
        },
      });
    }

    return () => {
      removeLayersAndSource(map, [OBS_LAYER_ID], OBS_SOURCE_ID);
      removeLayersAndSource(map, [LAYER_ID], SOURCE_ID);
    };
  }, [map, data]);

  useEffect(() => {
    if (!map) return;
    for (const id of [LAYER_ID, OBS_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", isActive ? "visible" : "none");
    }
  }, [map, isActive]);

  return null;
}
