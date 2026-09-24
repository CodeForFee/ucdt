import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";
import { MAP3D_CONFIG } from "@/shared/lib/map3DConfig";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { indexByName, findZone } from "@/shared/lib/floodZones";
import { isMapUsable, removeLayersAndSource, whenStyleReady } from "@/shared/components/map/mapLayerLifecycle";
import type { SimulationResult } from "@/shared/types/simulation";

interface FloodExtrusion3DProps {
  map: mapboxgl.Map;
  /** Mutation data from useSimulation() — undefined until a POST /api/simulation
   *  lands, in which case this renders the unmodified baseline (DP3: no local
   *  recompute of a value the processing layer owns). */
  result?: SimulationResult;
}

const SOURCE_ID = "flood-3d-source";
const LAYER_ID = MAP3D_CONFIG.floodExtrusionId;
const LABEL_ID = "flood-3d-label";

function riskLevelColor(level: string): string {
  switch (level) {
    case "critical":
      return "#ef4444";
    case "high":
      return "#f97316";
    case "medium":
      return "#eab308";
    default:
      return "#3b82f6";
  }
}

function riskLevelLabel(level: string): string {
  switch (level) {
    case "critical":
      return "Nguy hiểm";
    case "high":
      return "Cao";
    case "medium":
      return "Trung bình";
    default:
      return "Thấp";
  }
}

function applyLayer(map: mapboxgl.Map, geojson: FeatureCollection) {
  try {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
    } else {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson);
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["get", "estimatedDepth"],
            0,
            "#93c5fd",
            0.3,
            "#3b82f6",
            0.6,
            "#1d4ed8",
            0.8,
            "#ef4444",
          ],
          "fill-extrusion-height": ["*", ["get", "estimatedDepth"], 80],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.72,
        },
      });
    }

    if (!map.getLayer(LABEL_ID)) {
      map.addLayer({
        id: LABEL_ID,
        type: "symbol",
        source: SOURCE_ID,
        minzoom: 10,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-max-width": 10,
          "text-anchor": "top",
          "text-offset": [0, 1.5],
          "symbol-placement": "point",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.8)",
          "text-halo-width": 1.5,
          "text-opacity": 0.8,
        },
      });
    }
  } catch {
    /* style not ready */
  }
}

function buildBadgeEl(depth: number, level: string): HTMLElement {
  const color = riskLevelColor(level);
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer; display:flex; flex-direction:column; align-items:center;";

  const badge = document.createElement("div");
  badge.style.cssText = `
    background: ${color};
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 13px;
    font-weight: 800;
    padding: 5px 10px;
    border-radius: 6px;
    border: 2px solid rgba(255,255,255,0.6);
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    line-height: 1;
    white-space: nowrap;
    text-transform: uppercase;
  `;
  badge.textContent = `${(depth * 100).toFixed(0)}cm`;

  const triangle = document.createElement("div");
  triangle.style.cssText = `
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid ${color};
    margin-top: -1px;
  `;

  el.appendChild(badge);
  el.appendChild(triangle);
  return el;
}

export function FloodExtrusion3D({ map, result }: FloodExtrusion3DProps) {
  const { data: baseline } = useFloodRisk();
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    const baselineAreas = baseline?.affectedAreas ?? [];
    const simAreas = result?.results?.newFloodAreas ?? [];

    // Shared canonical-name join — must agree with the sidebar on which zones a
    // scenario touched.
    const simMap = indexByName(simAreas);

    const areas =
      simAreas.length > 0
        ? baselineAreas.map((ba) => {
            const sa = findZone(simMap, ba.name);
            return sa ?? ba;
          })
        : baselineAreas;

    if (!areas.length) {
      try {
        if (map.getSource(SOURCE_ID)) {
          (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features: [] });
        }
      } catch {
        /* style not ready */
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      return;
    }

    const geojson: FeatureCollection = {
      type: "FeatureCollection",
      features: areas
        .filter((a) => a.geojson)
        .map((a) => ({
          ...a.geojson,
          properties: {
            ...a.geojson.properties,
            name: a.name,
            estimatedDepth: a.estimatedDepth,
            riskLevel: a.riskLevel,
            riskScore: a.riskScore,
          },
        })) as Feature[],
    };

    const cancelSetup = whenStyleReady(map, () => applyLayer(map, geojson));

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    areas.forEach((a) => {
      const el = buildBadgeEl(a.estimatedDepth, a.riskLevel);

      const onClick = () => {
        const color = riskLevelColor(a.riskLevel);
        const label = riskLevelLabel(a.riskLevel);
        const scoreText = a.riskScore != null ? `${Math.round(a.riskScore * 100)}` : "–";
        const depthText = a.estimatedDepth != null ? `${(a.estimatedDepth * 100).toFixed(0)} cm` : "–";

        const html = `
          <div style="font-family:Arial,sans-serif; display:flex; flex-direction:column; align-items:center; padding:6px 10px; text-align:center; min-width:140px;">
            <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:#1e293b; width:100%; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">${a.name}</div>
            <div style="color:#94a3b8; font-size:11px; margin-bottom:10px; font-weight:500;">Rủi ro: ${scoreText}% · ${label}</div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
              <div style="background:${color}; color:#fff; font-weight:700; font-size:20px; padding: 10px 14px; display:flex; align-items:center; justify-content:center; border-radius:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${depthText}</div>
            </div>
          </div>
        `;

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ closeButton: false, maxWidth: "240px", offset: [0, -10] })
          .setLngLat([a.lng, a.lat])
          .setHTML(html)
          .addTo(map);
      };

      el.addEventListener("click", onClick);

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([a.lng, a.lat]).addTo(map);
      markersRef.current.push(marker);
    });

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("mouseenter", LAYER_ID, onEnter);
    map.on("mouseleave", LAYER_ID, onLeave);

    return () => {
      cancelSetup();
      try {
        map.off("mouseenter", LAYER_ID, onEnter);
        map.off("mouseleave", LAYER_ID, onLeave);
      } catch {
        /* map torn down */
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      // Layers + source stay: the next run of this effect upserts them via applyLayer's
      // setData. Tearing them down on every new result made the extrusion flash on each
      // slider tick; they are removed only when the component unmounts (below).
    };
  }, [map, result, baseline]);

  useEffect(
    () => () => {
      if (!isMapUsable(map)) return;
      removeLayersAndSource(map, [LABEL_ID, LAYER_ID], SOURCE_ID);
    },
    [map],
  );

  return null;
}
