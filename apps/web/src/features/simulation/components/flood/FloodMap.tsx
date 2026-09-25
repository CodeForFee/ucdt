import { useEffect } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useTranslations } from "use-intl";
import { useSimMap } from "../shared/useSimMap";
import { MapControls } from "../shared/MapControls";
import { MapBootOverlay } from "@/shared/components/map/MapBootOverlay";
import { TerrainLayer } from "@/shared/components/map/TerrainLayer";
import { BuildingLayer3D } from "@/shared/components/map/BuildingLayer3D";
import { FloodExtrusion3D } from "../FloodExtrusion3D";
import { RainOverlay } from "../RainOverlay";
import { FloodLegend } from "../FloodLegend";
import { useFocusPoint } from "../shared/useFocusPoint";
import type { SimulationResult } from "@/shared/types/simulation";

interface FloodMapProps {
  result?: SimulationResult;
}

export function FloodMap({ result }: FloodMapProps) {
  const { params } = useSimulationStore();
  const ts = useTranslations("simulation");
  const { containerRef, map, styleKey, setStyleKey, resetView, reset3DView } = useSimMap();
  useFocusPoint(map);

  useEffect(() => {
    if (!map) return;
    map.easeTo({
      pitch: params.enable3D ? 55 : 0,
      bearing: params.enable3D ? -17 : 0,
      duration: map.loaded() ? 800 : 0,
    });
  }, [params.enable3D, map]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={`w-full h-full transition-opacity duration-300 ${map ? "opacity-100" : "opacity-0"}`}
      />
      {!map && <MapBootOverlay />}

      {map && (
        <>
          {params.enable3D && <TerrainLayer map={map} />}
          {params.showBuildings && <BuildingLayer3D map={map} hasResult={!!result} />}
          <FloodExtrusion3D map={map} result={result} />
          {params.rainfallMultiplier > 1 && <RainOverlay intensity={params.rainfallMultiplier} />}
        </>
      )}

      <MapControls styleKey={styleKey} onStyleChange={setStyleKey} onReset2D={resetView} onReset3D={() => reset3DView()} />
      <FloodLegend />

      {!result && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-card/80 backdrop-blur-sm rounded-xl px-6 py-4 border border-border text-center shadow-xl">
            <p className="text-sm font-medium">{ts("idleHint")}</p>
            <p className="text-xs text-muted-foreground mt-1">{ts("idleHintSub")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
