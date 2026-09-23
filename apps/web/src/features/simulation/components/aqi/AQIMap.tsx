import "mapbox-gl/dist/mapbox-gl.css";
import { useTranslations } from "use-intl";
import { useWeatherData } from "@/shared/hooks/useWeatherData";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { useSimMap } from "../shared/useSimMap";
import { MapControls } from "../shared/MapControls";
import { MapBootOverlay } from "@/shared/components/map/MapBootOverlay";
import { useFocusPoint } from "../shared/useFocusPoint";
import { SimAQILayer } from "../SimAQILayer";
import { WindParticleLayer } from "../WindParticleLayer";
import { AQILegend } from "../AQILegend";
import type { SimulationResult } from "@/shared/types/simulation";

interface AQIMapProps {
  result?: SimulationResult;
}

function aqiBadgeColor(aqi: number) {
  if (aqi <= 50) return "#009966";
  if (aqi <= 100) return "#ffde33";
  if (aqi <= 150) return "#ff9933";
  if (aqi <= 200) return "#cc0033";
  if (aqi <= 300) return "#660099";
  return "#7e0023";
}

function WindInfoBadge({ result }: { result?: SimulationResult }) {
  const { data: weather } = useWeatherData();
  const { data: aqi } = useAQIData();
  const tMap = useTranslations("aqiMap");

  const windSpeed = weather?.current?.windSpeed ?? "—";
  const windDir = weather?.current?.windDirection as number | undefined;
  const aqiBase = aqi?.aqi ?? null;
  const dirLabel = windDir != null ? (tMap.raw("compassPoints") as string[])[Math.round(windDir / 45) % 8] : "—";

  // DP3: the delta shown here is the backend's own aqiDelta, never a recomputed one.
  const aqiDelta = result?.results?.aqiDelta ?? null;
  const aqiSim = aqiBase != null && aqiDelta != null ? Math.max(0, Math.round(aqiBase + aqiDelta)) : null;
  const delta = aqiBase != null && aqiSim != null ? aqiSim - aqiBase : 0;

  return (
    <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg text-xs space-y-1.5">
      <div className="flex items-center gap-2.5">
        <div className="relative w-8 h-8 shrink-0">
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1" className="text-border" />
            <text x="16" y="5" textAnchor="middle" fontSize="4" fill="currentColor" className="text-muted-foreground" dominantBaseline="middle">
              {tMap("compass.n")}
            </text>
            <text x="16" y="28" textAnchor="middle" fontSize="4" fill="currentColor" className="text-muted-foreground" dominantBaseline="middle">
              {tMap("compass.s")}
            </text>
            <text x="4" y="16" textAnchor="middle" fontSize="4" fill="currentColor" className="text-muted-foreground" dominantBaseline="middle">
              {tMap("compass.w")}
            </text>
            <text x="28" y="16" textAnchor="middle" fontSize="4" fill="currentColor" className="text-muted-foreground" dominantBaseline="middle">
              {tMap("compass.e")}
            </text>
            {windDir != null && (
              <g transform={`rotate(${windDir}, 16, 16)`}>
                <line x1="16" y1="16" x2="16" y2="5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                <polygon points="16,3 14,7 18,7" fill="#3b82f6" />
                <line x1="16" y1="16" x2="16" y2="25" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            )}
            <circle cx="16" cy="16" r="2" fill="#3b82f6" />
          </svg>
        </div>
        <div>
          <div className="font-medium text-foreground">
            {dirLabel} · {windSpeed} km/h
          </div>
          <div className="text-[10px] text-muted-foreground">{tMap("windDir")}</div>
        </div>
      </div>
      {aqiBase != null && (
        <div className="flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: aqiBadgeColor(aqiBase), color: aqiBase > 50 && aqiBase <= 100 ? "#333" : "#fff" }}
          >
            {aqiBase}
          </span>
          <span className="text-muted-foreground">{tMap("observed")}</span>
          {aqiSim != null && (
            <>
              <span className="text-muted-foreground">→</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-yellow-400"
                style={{ background: aqiBadgeColor(aqiSim), color: aqiSim > 50 && aqiSim <= 100 ? "#333" : "#fff" }}
              >
                {aqiSim}
              </span>
              <span className={`font-semibold text-[10px] ${delta < 0 ? "text-green-400" : "text-red-400"}`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AQIMap({ result }: AQIMapProps) {
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

      {map && (
        <>
          <WindParticleLayer map={map} />
          {result && <SimAQILayer map={map} result={result} />}
        </>
      )}

      <MapControls styleKey={styleKey} onStyleChange={setStyleKey} onReset2D={resetView} onReset3D={() => reset3DView()} />

      <WindInfoBadge result={result} />
      <AQILegend />

      {!result && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-card/80 backdrop-blur-sm rounded-xl px-6 py-4 border border-border text-center shadow-xl">
            <p className="text-sm font-medium">{ts("idleHint")}</p>
            <p className="text-xs text-muted-foreground mt-1">{ts("idleHintAqi")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
