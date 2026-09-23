import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Point } from "geojson";
import { useHeatMap } from "@/shared/hooks/useHeatMap";
import { useTranslations } from "use-intl";
import type { SimulationResult } from "@/shared/types/simulation";
import { isMapUsable, whenStyleReady } from "@/shared/components/map/mapLayerLifecycle";
import { buildHeatGeojson } from "./heatGeojson";

interface SimHeatLayerProps {
  map: mapboxgl.Map;
  /** Mutation data from useSimulation() — undefined until a POST /api/simulation lands. */
  result?: SimulationResult;
}

const SOURCE = "sim-heat-source";
const LAYER = "sim-heat-layer";
const TEMP_LAYER = "sim-temp-circles";
const TEMP_TEXT = "sim-temp-text";

function isStyleReady(map: mapboxgl.Map): boolean {
  try {
    return map.isStyleLoaded();
  } catch {
    return false;
  }
}

// Each removal step is individually guarded so one failure doesn't skip the rest — an
// orphaned layer still pointing at a removed source crashes mapbox-gl's placement pass.
function removeLayers(map: mapboxgl.Map) {
  try {
    if (map.getLayer(TEMP_TEXT)) map.removeLayer(TEMP_TEXT);
  } catch {
    /* already gone */
  }
  try {
    if (map.getLayer(TEMP_LAYER)) map.removeLayer(TEMP_LAYER);
  } catch {
    /* already gone */
  }
  try {
    if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  } catch {
    /* already gone */
  }
  try {
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  } catch {
    /* already gone */
  }
}

function addLayers(map: mapboxgl.Map) {
  try {
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: "heatmap",
        source: SOURCE,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "intensity"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 4],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 40, 14, 80],
          "heatmap-opacity": 0.75,
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
            "#7f1d1d",
          ],
        },
      });
    }
    if (!map.getLayer(TEMP_LAYER)) {
      map.addLayer({
        id: TEMP_LAYER,
        type: "circle",
        source: SOURCE,
        minzoom: 11,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 24, 14, 40],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "temp"],
            30,
            "#fde047",
            35,
            "#f97316",
            38,
            "#ef4444",
            42,
            "#7f1d1d",
          ],
          "circle-opacity": 0.95,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
          "circle-stroke-opacity": 0.8,
        },
      });
    }
    if (!map.getLayer(TEMP_TEXT)) {
      map.addLayer({
        id: TEMP_TEXT,
        type: "symbol",
        source: SOURCE,
        minzoom: 11,
        layout: {
          "text-field": ["concat", ["to-string", ["round", ["get", "temp"]]], "°"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 14, 14, 18],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#fff",
          "text-halo-color": "rgba(0,0,0,0.4)",
          "text-halo-width": 1,
        },
      });
    }
  } catch {
    /* style not ready */
  }
}

export function SimHeatLayer({ map, result }: SimHeatLayerProps) {
  const { data } = useHeatMap();
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const lu = useTranslations("landUse");

  const tempDelta = result?.results?.tempDelta ?? null;

  // Setup: add source + layers once map/data are ready.
  useEffect(() => {
    if (!map || !data?.hotspots?.length) return;

    const geojson = buildHeatGeojson(data.hotspots, tempDelta);

    const cancelSetup = whenStyleReady(map, () => {
      try {
        if (!map.getSource(SOURCE)) {
          map.addSource(SOURCE, { type: "geojson", data: geojson });
        }
        addLayers(map);
      } catch {
        /* style not ready */
      }
    });

    return () => {
      cancelSetup();
      if (!isMapUsable(map)) return;
      removeLayers(map);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- data/tempDelta handled below
  }, [map, data]);

  // Click popup on the temperature circles.
  useEffect(() => {
    if (!map) return;

    const lastPoint = { current: null as string | null };

    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const { name, temp } = feat.properties as { name: string; temp: number };
      const coords = (feat.geometry as Point).coordinates as [number, number];
      const displayName = name || lu("hotspot");
      const pointId = `${coords[0]},${coords[1]}`;

      if (popupRef.current?.isOpen() && lastPoint.current === pointId) {
        popupRef.current.remove();
        lastPoint.current = null;
        return;
      }

      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: true,
        maxWidth: "220px",
        offset: [0, -4],
      })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:Arial,sans-serif; display:flex; flex-direction:column; align-items:center; padding:6px 10px; text-align:center; min-width:140px;">
            <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:#1e293b; width:100%; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">${displayName}</div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
              <div style="background:#f97316; color:#fff; font-weight:700; font-size:22px; width:54px; height:54px; display:flex; align-items:center; justify-content:center; border-radius:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${temp}°</div>
            </div>
          </div>`,
        )
        .addTo(map);
      lastPoint.current = pointId;
    };

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", TEMP_LAYER, onClick);
    map.on("mouseenter", TEMP_LAYER, onEnter);
    map.on("mouseleave", TEMP_LAYER, onLeave);

    return () => {
      map.off("click", TEMP_LAYER, onClick);
      map.off("mouseenter", TEMP_LAYER, onEnter);
      map.off("mouseleave", TEMP_LAYER, onLeave);
      popupRef.current?.remove();
      popupRef.current = null;
    };
  }, [map, lu]);

  // Refresh data whenever the backend delta changes.
  useEffect(() => {
    if (!map || !data?.hotspots?.length || !isMapUsable(map) || !isStyleReady(map)) return;

    const geojson = buildHeatGeojson(data.hotspots, tempDelta);

    try {
      const src = map.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(geojson);
      } else {
        map.addSource(SOURCE, { type: "geojson", data: geojson });
        addLayers(map);
      }
    } catch {
      /* style not ready */
    }
  }, [map, data, tempDelta]);

  return null;
}
