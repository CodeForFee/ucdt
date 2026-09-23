import "mapbox-gl/dist/mapbox-gl.css";
import { useSimMap } from "../shared/useSimMap";
import { MapControls } from "../shared/MapControls";
import { MapBootOverlay } from "@/shared/components/map/MapBootOverlay";
import { SimHeatLayer } from "../SimHeatLayer";
import { useTranslations } from "use-intl";
import { useFocusPoint } from "../shared/useFocusPoint";
import type { SimulationResult } from "@/shared/types/simulation";

interface HeatMapProps {
  result?: SimulationResult;
}

export function HeatMap({ result }: HeatMapProps) {
  const ts = useTranslations("simulation");
  const { containerRef, map, styleKey, setStyleKey, resetView, reset3DView } = useSimMap();
  useFocusPoint(map);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={`w-full h-full transition-opacity duration-300 ${map ? "opacity-100" : "opacity-0"}`}
      />
      {!map && <MapBootOverlay />}

      {/* Mounted regardless of `result` — it renders the backend delta once one lands,
          and 0 (baseline) before that; see SimHeatLayer/heatGeojson (B-006). */}
      {map && <SimHeatLayer map={map} result={result} />}

      <MapControls styleKey={styleKey} onStyleChange={setStyleKey} onReset2D={resetView} onReset3D={() => reset3DView()} />

      {!result && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-card/85 backdrop-blur-sm rounded-lg px-4 py-2.5 border border-border shadow-lg text-center">
            <p className="text-xs text-muted-foreground">{ts("idleHintHeat")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
