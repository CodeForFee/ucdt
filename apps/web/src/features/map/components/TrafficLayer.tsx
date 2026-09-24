import { useEffect } from "react";
import type { Map as MapboxMap, Expression } from "mapbox-gl";
import { useMapStore } from "@/shared/stores/mapStore";
import { removeLayersAndSource } from "@/shared/components/map/mapLayerLifecycle";

interface TrafficLayerProps {
  map: MapboxMap;
}

const SOURCE_ID = "mapbox-traffic";
const LAYER_IDS = ["traffic-low", "traffic-moderate", "traffic-heavy", "traffic-severe"];

export function TrafficLayer({ map }: TrafficLayerProps) {
  const { activeLayers } = useMapStore();
  const isActive = activeLayers.includes("traffic");

  useEffect(() => {
    if (!map) return;

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "vector",
        url: "mapbox://mapbox.mapbox-traffic-v1",
      });
    }

    const layers = [
      { id: "traffic-low", color: "#22c55e", filter: ["==", "congestion", "low"] },
      { id: "traffic-moderate", color: "#eab308", filter: ["==", "congestion", "moderate"] },
      { id: "traffic-heavy", color: "#f97316", filter: ["==", "congestion", "heavy"] },
      { id: "traffic-severe", color: "#ef4444", filter: ["==", "congestion", "severe"] },
    ];

    layers.forEach((l) => {
      if (!map.getLayer(l.id)) {
        map.addLayer({
          id: l.id,
          type: "line",
          source: SOURCE_ID,
          "source-layer": "traffic",
          paint: {
            "line-color": l.color,
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 15, 4, 20, 8],
            "line-opacity": 0.8,
          },
          filter: l.filter as Expression,
          layout: {
            visibility: isActive ? "visible" : "none",
            "line-join": "round",
            "line-cap": "round",
          },
        });
      }
    });

    // Removing on every unmount avoids an orphaned "mapbox-traffic" source blocking a
    // later addSource with a duplicate-id error.
    return () => {
      removeLayersAndSource(map, LAYER_IDS, SOURCE_ID);
    };
  }, [map, isActive]);

  useEffect(() => {
    if (!map) return;
    LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", isActive ? "visible" : "none");
      }
    });
  }, [map, isActive]);

  return null;
}
