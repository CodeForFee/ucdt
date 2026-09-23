import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { isMapUsable, whenStyleReady } from "@/shared/components/map/mapLayerLifecycle";

interface BuildingLayer3DProps {
  map: MapboxMap;
  /** Whether a simulation result is active — swaps the paint expression to highlight
   *  flood-affected buildings instead of the plain height ramp. Passed in rather than
   *  read from a store: this component has no business knowing about the simulation
   *  feature's state shape. */
  hasResult?: boolean;
}

const LAYER_ID = "building-extrusion";

function applyLayer(map: MapboxMap, hasResult: boolean) {
  if (map.getLayer(LAYER_ID)) return;

  // The 'composite' source only exists in Mapbox Streets/Dark/Light styles.
  if (!map.getSource("composite")) return;

  const style = map.getStyle();
  const labelLayer = style?.layers?.find(
    (l) => l.type === "symbol" && (l.id.includes("label") || l.id.includes("place")),
  )?.id;

  try {
    map.addLayer(
      {
        id: LAYER_ID,
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 8,
        paint: {
          "fill-extrusion-color": hasResult
            ? ["case", ["boolean", ["feature-state", "flood_affected"], false], "#ef4444", "#1e293b"]
            : ["interpolate", ["linear"], ["get", "height"], 0, "#1e293b", 100, "#334155", 250, "#94a3b8"],
          "fill-extrusion-height": [
            "interpolate", ["linear"], ["zoom"],
            8, ["*", ["get", "height"], 200],
            11, ["*", ["get", "height"], 80],
            13, ["*", ["get", "height"], 30],
            15, ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate", ["linear"], ["zoom"],
            8, ["*", ["get", "min_height"], 200],
            11, ["*", ["get", "min_height"], 80],
            13, ["*", ["get", "min_height"], 30],
            15, ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.95,
        },
      },
      labelLayer,
    );
  } catch {
    // style doesn't support a building layer (e.g. satellite-streets)
  }
}

export function BuildingLayer3D({ map, hasResult = false }: BuildingLayer3DProps) {
  useEffect(() => {
    if (!map) return;

    // Style switches are handled by unmount/remount upstream, so setup here runs once
    // when the style is ready — not on 'styledata', which fires continuously as tiles
    // arrive and previously caused layers to be added mid style-switch.
    const cancelSetup = whenStyleReady(map, () => applyLayer(map, hasResult));

    return () => {
      cancelSetup();
      if (!isMapUsable(map)) return;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      } catch {
        /* map torn down */
      }
    };
  }, [map, hasResult]);

  return null;
}
