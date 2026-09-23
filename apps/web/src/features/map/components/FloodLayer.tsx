import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { FLOOD_COLORS } from "@/shared/lib/colorScales";
import { useMapStore } from "@/shared/stores/mapStore";
import { removeLayersAndSource } from "@/shared/components/map/mapLayerLifecycle";

interface FloodLayerProps {
  map: mapboxgl.Map;
}

function riskLabel(level: string): string {
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

function riskColor(level: string): string {
  return (FLOOD_COLORS as Record<string, string>)[level] ?? "#86efac";
}

const SOURCE_ID = "flood-source";
const FILL_ID = "flood-fill";
const OUTLINE_ID = "flood-outline";
const LABEL_ID = "flood-label";

export function FloodLayer({ map }: FloodLayerProps) {
  const { data } = useFloodRisk();
  const { activeLayers } = useMapStore();
  const isActive = activeLayers.includes("flood");
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  useEffect(() => {
    if (!map || !data?.affectedAreas?.length) return;

    const geojson: FeatureCollection = {
      type: "FeatureCollection",
      features: data.affectedAreas.map((area) => ({
        ...area.geojson,
        properties: {
          ...area.geojson.properties,
          name: area.name,
          riskLevel: area.riskLevel,
          riskScore: area.riskScore,
          estimatedDepth: area.estimatedDepth,
        },
      })) as Feature[],
    };

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });
    } else {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource).setData(geojson);
    }

    if (!map.getLayer(FILL_ID)) {
      map.addLayer({
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": [
            "match",
            ["get", "riskLevel"],
            "low",
            FLOOD_COLORS.low,
            "medium",
            FLOOD_COLORS.medium,
            "high",
            FLOOD_COLORS.high,
            "critical",
            FLOOD_COLORS.critical,
            "#86efac",
          ],
          "fill-opacity": 0.65,
        },
      });
    }

    if (!map.getLayer(OUTLINE_ID)) {
      map.addLayer({
        id: OUTLINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 0.6,
          "line-width": 1.5,
        },
      });
    }

    if (!map.getLayer(LABEL_ID)) {
      map.addLayer({
        id: LABEL_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 11,
          "text-max-width": 10,
          "text-anchor": "center",
          "symbol-placement": "point",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.5,
        },
      });
    }

    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const onClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0] as Feature | undefined;
      if (!f?.properties) return;

      const name = f.properties.name as string;
      const level = f.properties.riskLevel as string;
      const score = f.properties.riskScore as number;
      const depth = f.properties.estimatedDepth as number;
      const color = riskColor(level);
      const label = riskLabel(level);

      popupRef.current?.remove();

      const html = `
        <div style="font-family:sans-serif;font-size:13px;min-width:190px;line-height:1.6">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">${name}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="background:${color}25;color:${color};border:1px solid ${color}60;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600">${label}</span>
            <span style="color:#999;font-size:11px">Rủi ro: ${Math.round(score * 100)}%</span>
          </div>
          <div style="color:#bbb;font-size:12px">Độ sâu ước tính: <b style="color:#fff">${(depth * 100).toFixed(0)} cm</b></div>
        </div>
      `;

      popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: "250px" }).setLngLat(e.lngLat).setHTML(html).addTo(map);
    };

    map.on("mouseenter", FILL_ID, onEnter);
    map.on("mouseleave", FILL_ID, onLeave);
    map.on("click", FILL_ID, onClick);

    return () => {
      map.off("mouseenter", FILL_ID, onEnter);
      map.off("mouseleave", FILL_ID, onLeave);
      map.off("click", FILL_ID, onClick);
      popupRef.current?.remove();

      removeLayersAndSource(map, [LABEL_ID, OUTLINE_ID, FILL_ID], SOURCE_ID);
    };
  }, [map, data]);

  useEffect(() => {
    if (!map) return;
    const v = isActive ? "visible" : "none";
    if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, "visibility", v);
    if (map.getLayer(OUTLINE_ID)) map.setLayoutProperty(OUTLINE_ID, "visibility", v);
    if (map.getLayer(LABEL_ID)) map.setLayoutProperty(LABEL_ID, "visibility", v);
  }, [map, isActive]);

  return null;
}
