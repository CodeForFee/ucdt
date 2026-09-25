import { Button } from "@/components/ui/button";
import { RainfallSlider } from "../RainfallSlider";
import { ComparePanel } from "../ComparePanel";
import { ScenarioRecommendations } from "../ScenarioRecommendations";
import { GreenCoverageSlider } from "../shared/BaselineSliders";
import { SidebarShell } from "../shared/SidebarShell";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { Wind, RotateCcw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useTranslations } from "use-intl";
import type { SimulationResult } from "@/shared/types/simulation";

function aqiColor(aqi: number) {
  if (aqi <= 50) return "bg-[#009966]";
  if (aqi <= 100) return "bg-[#ffde33]";
  if (aqi <= 150) return "bg-[#ff9933]";
  if (aqi <= 200) return "bg-[#cc0033]";
  if (aqi <= 300) return "bg-[#660099]";
  return "bg-[#7e0023]";
}

function aqiLabel(aqi: number, tAqi: (k: "good" | "moderate" | "sensitive" | "unhealthy" | "veryUnhealthy" | "hazardous") => string) {
  if (aqi <= 50) return tAqi("good");
  if (aqi <= 100) return tAqi("moderate");
  if (aqi <= 150) return tAqi("sensitive");
  if (aqi <= 200) return tAqi("unhealthy");
  if (aqi <= 300) return tAqi("veryUnhealthy");
  return tAqi("hazardous");
}

/** B-006-equivalent for AQI: broadcasts the backend's own city-level aqiDelta, 0 before
 *  a result exists. No local AQI formula (legacy's shared/lib/pdim.ts has no equivalent
 *  here). */
function AQISimPreview({ result }: { result?: SimulationResult }) {
  const { data } = useAQIData();
  const tAqi = useTranslations("aqi");
  const sp = useTranslations("simulation.preview");
  if (!data) return null;

  const delta = result?.results?.aqiDelta ?? 0;
  const base = data.aqi;
  const sim = Math.max(0, Math.round(base + delta));
  const stationDelta = sim - base;

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sp("aqiTitle")}</p>
      </div>

      {/* items-start + equal-width side columns + an h-14 middle column: the two circles and
          the delta connector share one centre line whatever the labels underneath wrap to. */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="w-20 shrink-0 flex flex-col items-center gap-1.5 text-center">
          <div className={`${aqiColor(base)} w-14 h-14 rounded-full flex items-center justify-center text-base font-bold ${base > 50 && base <= 100 ? "text-gray-800" : "text-white"}`}>
            {base}
          </div>
          <span className="text-xs text-muted-foreground">{sp("current")}</span>
          <span className="text-xs text-muted-foreground">{aqiLabel(base, tAqi)}</span>
        </div>

        <div className="flex-1 h-14 flex flex-col items-center justify-center gap-1">
          <div className={`text-sm font-bold ${stationDelta < 0 ? "text-green-400" : stationDelta > 0 ? "text-red-400" : "text-muted-foreground"}`}>
            {stationDelta !== 0 ? (
              stationDelta > 0 ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {`+${stationDelta}`}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {stationDelta}
                </span>
              )
            ) : (
              <Minus className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="w-full h-px bg-border" />
        </div>

        <div className="w-20 shrink-0 flex flex-col items-center gap-1.5 text-center">
          <div
            className={`${aqiColor(sim)} w-14 h-14 rounded-full flex items-center justify-center text-base font-bold ${sim > 50 && sim <= 100 ? "text-gray-800" : "text-white"} ${stationDelta !== 0 ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-card" : ""}`}
          >
            {sim}
          </div>
          <span className="text-xs text-muted-foreground">{sp("simulated")}</span>
          <span
            className={`text-xs ${stationDelta < 0 ? "font-medium text-green-400" : stationDelta > 0 ? "font-medium text-red-400" : "text-muted-foreground"}`}
          >
            {aqiLabel(sim, tAqi)}
          </span>
        </div>
      </div>

    </div>
  );
}

interface AQISidebarProps {
  result?: SimulationResult;
  onReset: () => void;
}

export function AQISidebar({ result, onReset }: AQISidebarProps) {
  const ts = useTranslations("simulation");
  const sc = useTranslations("simulation.scenarios");
  const sl = useTranslations("simulation.sliders");
  const { params, setParams } = useSimulationStore();

  return (
    <SidebarShell title={ts("titleAqi")} icon={<Wind className="h-4 w-4 text-green-400" />} collapsedIcons={<Wind className="h-4 w-4" />}>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <p className="text-xs text-muted-foreground">{ts("aqiDesc")}</p>

        <AQISimPreview result={result} />
        {/* Per-point before/after comes from results.stations (AQI_sim(i), §D). */}
        <ScenarioRecommendations result={result} showStations />

        <RainfallSlider
          label={sl("trafficReduction")}
          value={params.trafficReduction}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => setParams({ trafficReduction: v })}
          description={sl("trafficReductionAqiDesc")}
        />
        <GreenCoverageSlider description={sl("greenCoverageAqiDesc")} />
        <RainfallSlider
          label={sl("rainWash")}
          value={Math.round(params.rainfallMultiplier * 100)}
          min={0}
          max={300}
          step={5}
          unit="%"
          onChange={(v) => setParams({ rainfallMultiplier: v / 100 })}
          description={sl("rainWashDesc")}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{ts("quickScenario")}</label>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              // gc undefined = green cover left at the served G₀
              { label: sc("aqiLimitCars"), tr: 50, gc: undefined, rf: 1.0 },
              { label: sc("aqiPark"), tr: 20, gc: 0.5, rf: 1.0 },
              { label: sc("aqiCarFree"), tr: 100, gc: undefined, rf: 1.0 },
              { label: sc("aqiRain"), tr: 0, gc: undefined, rf: 2.5 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setParams({ trafficReduction: p.tr, greenCoverage: p.gc, rainfallMultiplier: p.rf })}
                className="text-left text-xs px-3 py-2 rounded-md bg-muted/40 hover:bg-muted border border-border/50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-border space-y-2">
        <Button size="sm" variant="outline" onClick={onReset} className="w-full">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {ts("reset")}
        </Button>
      </div>

      <div className="shrink-0 px-3 pb-3">
        <ComparePanel scenario="aqi" result={result} />
      </div>
    </SidebarShell>
  );
}
