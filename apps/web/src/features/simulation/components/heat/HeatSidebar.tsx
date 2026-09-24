import { Button } from "@/components/ui/button";
import { RainfallSlider } from "../RainfallSlider";
import { ComparePanel } from "../ComparePanel";
import { SidebarShell } from "../shared/SidebarShell";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useHeatMap } from "@/shared/hooks/useHeatMap";
import { Thermometer, Play, RotateCcw, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useTranslations } from "use-intl";
import type { SimulationResult } from "@/shared/types/simulation";

function tempRiskLabel(t: number, tr: (k: "critical" | "high" | "medium" | "low") => string) {
  if (t >= 44) return { label: tr("critical"), cls: "text-red-500" };
  if (t >= 40) return { label: tr("high"), cls: "text-orange-400" };
  if (t >= 37) return { label: tr("medium"), cls: "text-yellow-400" };
  return { label: tr("low"), cls: "text-green-400" };
}

function tempBarColor(t: number) {
  if (t >= 42) return "#ef4444";
  if (t >= 39) return "#f97316";
  if (t >= 36) return "#fde047";
  return "#22c55e";
}

/** B-006: the same rule as SimHeatLayer — this preview shows the backend's own
 *  tempDelta (0 before a result exists), never a client-recomputed estimate. */
function HeatSimPreview({ result, onFocus }: { result?: SimulationResult; onFocus: (lat: number, lng: number, popupHtml: string) => void }) {
  const { data } = useHeatMap();
  const tr = useTranslations("risk");
  const sp = useTranslations("simulation.preview");
  // B-020 / manuscript §4.2: ΔT perturbs the effective temperature T_eff = HI(T, RH) + ρ·3.5 °C,
  // so the baseline is the served mean T_eff of the cells (the same quantity as the zone list
  // below) — never the air temperature `avgTemperature`. Snapshots older than the field lack
  // it; the card waits for the next worker run rather than falling back to the wrong quantity.
  if (!data?.hotspots?.length || data.avgEffectiveTemperature == null) return null;

  const delta = result?.results?.tempDelta ?? 0;
  const avgBase = data.avgEffectiveTemperature;
  const avgSim = Math.round((avgBase + delta) * 10) / 10;
  const avgDelta = Math.round(delta * 10) / 10;

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sp("heatTitle")}</p>
      </div>

      <p className="px-4 pt-2 text-[11px] text-muted-foreground">{sp("heatBasis", { count: data.hotspots.length })}</p>

      {/* Same layout as the AQI preview: circles and connector on one centre line. */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="w-20 shrink-0 flex flex-col items-center gap-1.5 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold bg-orange-500/20 text-orange-400 border-2 border-orange-500/30">
            {avgBase}°
          </div>
          <span className="text-xs text-muted-foreground">{sp("current")}</span>
        </div>

        <div className="flex-1 h-14 flex flex-col items-center justify-center gap-1">
          <div className={`text-sm font-bold ${avgDelta < 0 ? "text-green-400" : avgDelta > 0 ? "text-red-400" : "text-muted-foreground"}`}>
            {avgDelta !== 0 ? (
              avgDelta > 0 ? (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {`+${avgDelta}°C`}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5" />
                  {`${avgDelta}°C`}
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
            className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold border-2 ${avgDelta !== 0 ? "ring-2 ring-yellow-400 ring-offset-2 ring-offset-card" : ""}`}
            style={{ background: tempBarColor(avgSim) + "33", color: tempBarColor(avgSim), borderColor: tempBarColor(avgSim) + "88" }}
          >
            {avgSim}°
          </div>
          <span className="text-xs text-muted-foreground">{sp("simulated")}</span>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="px-3 py-1.5 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground">
            {sp("districts")}
            {data.hotspots.length})
          </p>
        </div>
        <div className="divide-y divide-border/50 max-h-44 overflow-y-auto">
          {data.hotspots.map((h) => {
            const sim = Math.round((h.temperature + delta) * 10) / 10;
            const d = Math.round(delta * 10) / 10;
            const risk = tempRiskLabel(sim, tr);
            const simColor = tempBarColor(sim);
            const deltaStr = d > 0 ? `+${d}°C` : d < 0 ? `${d}°C` : "";
            const popupHtml = `
              <div style="font-family:Arial,sans-serif; display:flex; flex-direction:column; align-items:center; padding:6px 10px; text-align:center; min-width:150px;">
                <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:#1e293b; width:100%; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">${h.name}</div>
                <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:10px;">
                  <div style="background:#f97316; color:#fff; font-weight:700; font-size:22px; width:56px; height:56px; display:flex; align-items:center; justify-content:center; border-radius:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${h.temperature}°</div>
                  ${
                    d !== 0
                      ? `
                    <span style="color:#94a3b8; font-size:18px; font-weight:500;">→</span>
                    <div style="position:relative; display:flex; align-items:center;">
                      <div style="background:${simColor}; color:#fff; font-weight:700; font-size:22px; width:56px; height:56px; display:flex; align-items:center; justify-content:center; border-radius:12px; border:2px solid #facc15; box-shadow: 0 4px 12px rgba(250,204,21,0.2);">${sim}°</div>
                      <div style="position:absolute; left: 100%; margin-left: 8px; font-size:12px; font-weight:800; color:${d < 0 ? "#16a34a" : "#dc2626"}; white-space:nowrap;">${deltaStr}</div>
                    </div>
                  `
                      : ""
                  }
                </div>
                <div style="display:inline-block; padding:3px 10px; border-radius:6px; background:${simColor}22; color:${simColor}; font-size:12px; font-weight:700; border:1px solid ${simColor}44; margin-bottom:8px;">${risk.label}</div>
              </div>`;
            return (
              <div
                key={h.id}
                onClick={() => onFocus(h.lat, h.lng, popupHtml)}
                className="flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs truncate text-foreground flex-1">{h.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs font-medium text-orange-400">{h.temperature}°</span>
                  {d !== 0 && (
                    <>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-xs font-semibold" style={{ color: tempBarColor(sim) }}>
                        {sim}°
                      </span>
                      <span className={`text-[10px] font-bold ${d < 0 ? "text-green-400" : "text-red-400"}`}>{d > 0 ? `+${d}` : d}</span>
                    </>
                  )}
                  <span className={`text-[10px] font-medium ${risk.cls}`}>{risk.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface HeatSidebarProps {
  result?: SimulationResult;
  isPending: boolean;
  onRun: () => void;
  onReset: () => void;
}

export function HeatSidebar({ result, isPending, onRun, onReset }: HeatSidebarProps) {
  const ts = useTranslations("simulation");
  const sc = useTranslations("simulation.scenarios");
  const sl = useTranslations("simulation.sliders");
  const { params, setParams, setFocusPoint } = useSimulationStore();

  return (
    <SidebarShell title={ts("titleHeat")} icon={<Thermometer className="h-4 w-4 text-orange-400" />} collapsedIcons={<Thermometer className="h-4 w-4" />}>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <p className="text-xs text-muted-foreground">{ts("heatDesc")}</p>

        <HeatSimPreview result={result} onFocus={(lat, lng, popupHtml) => setFocusPoint({ lat, lng, popupHtml })} />

        <RainfallSlider
          label={sl("urbanDensity")}
          value={Math.round((params.urbanDensity ?? 0.8) * 100)}
          min={10}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => setParams({ urbanDensity: v / 100 })}
          description={sl("urbanDensityDesc")}
        />
        <RainfallSlider
          label={sl("greenCoverage")}
          value={Math.round(params.greenCoverage * 100)}
          min={0}
          max={80}
          step={5}
          unit="%"
          onChange={(v) => setParams({ greenCoverage: v / 100 })}
          description={sl("greenCoverageHeatDesc")}
        />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{ts("quickScenario")}</label>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              { label: sc("heatGreenCity"), gc: 0.7, ud: 0.8 },
              { label: sc("heatUrban"), gc: 0.1, ud: 0.95 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setParams({ greenCoverage: p.gc, urbanDensity: p.ud })}
                className="text-left text-xs px-3 py-2 rounded-md bg-muted/40 hover:bg-muted border border-border/50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-border space-y-2">
        <Button size="sm" onClick={onRun} disabled={isPending} className="w-full">
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? ts("running") : ts("run")}
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} className="w-full">
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {ts("reset")}
        </Button>
        <ComparePanel scenario="heat" result={result} />
      </div>
    </SidebarShell>
  );
}
