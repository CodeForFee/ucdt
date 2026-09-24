import { Button } from "@/components/ui/button";
import { RainfallSlider } from "../RainfallSlider";
import { ComparePanel } from "../ComparePanel";
import { ScenarioRecommendations } from "../ScenarioRecommendations";
import { GreenCoverageSlider } from "../shared/BaselineSliders";
import { SidebarShell } from "../shared/SidebarShell";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { Droplets, Play, RotateCcw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTranslations } from "use-intl";
import { indexByName, findZone } from "@/shared/lib/floodZones";
import type { SimulationResult } from "@/shared/types/simulation";

function riskLabel(score: number, tr: (k: "critical" | "high" | "medium" | "low") => string) {
  if (score >= 0.75) return { text: tr("critical"), cls: "text-red-400 bg-red-500/15" };
  if (score >= 0.5) return { text: tr("high"), cls: "text-orange-400 bg-orange-500/15" };
  if (score >= 0.25) return { text: tr("medium"), cls: "text-yellow-400 bg-yellow-500/15" };
  return { text: tr("low"), cls: "text-green-400 bg-green-500/15" };
}

function riskBarColor(score: number) {
  if (score >= 0.75) return "#ef4444";
  if (score >= 0.5) return "#f97316";
  if (score >= 0.25) return "#eab308";
  return "#22c55e";
}

function FloodAreasList({ result }: { result?: SimulationResult }) {
  const { data: baseline } = useFloodRisk();
  const { setFocusPoint } = useSimulationStore();
  const t = useTranslations();

  const baselineAreas = baseline?.affectedAreas ?? [];
  const simAreas = result?.results?.newFloodAreas ?? [];
  const simIndex = indexByName(simAreas);

  if (!baselineAreas.length) return null;

  return (
    <div className="border-t border-border">
      <div className="px-3 py-1.5 bg-muted/30 flex justify-between items-center">
        <p className="text-xs font-medium text-muted-foreground">
          {t("simulation.preview.affectedAreas") || "Khu vực ảnh hưởng"} ({baselineAreas.length})
        </p>
      </div>
      <div className="divide-y divide-border/50 max-h-56 overflow-y-auto bg-card/30">
        {baselineAreas.map((base) => {
          const sim = findZone(simIndex, base.name);
          const simDepth = sim ? sim.estimatedDepth : base.estimatedDepth;
          const simScore = sim ? sim.riskScore : base.riskScore;

          const hasChanged = Math.abs(simDepth - base.estimatedDepth) > 0.01;
          const delta = Math.round((simScore - base.riskScore) * 100);
          const simColor = riskBarColor(simScore);

          const baseDepthText = `${(base.estimatedDepth * 100).toFixed(0)}cm`;
          const simDepthText = `${(simDepth * 100).toFixed(0)}cm`;

          const popupHtml = `
            <div style="font-family:Arial,sans-serif; display:flex; flex-direction:column; align-items:center; padding:6px 10px; text-align:center; min-width:160px;">
              <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:#1e293b; width:100%; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">${base.name}</div>
              <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:10px;">
                <div style="background:#94a3b8; color:#fff; font-weight:700; font-size:18px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:10px;">${baseDepthText}</div>
                ${
                  hasChanged
                    ? `
                  <span style="color:#94a3b8; font-size:18px;">→</span>
                  <div style="background:${simColor}; color:#fff; font-weight:700; font-size:20px; width:52px; height:52px; display:flex; align-items:center; justify-content:center; border-radius:10px; border:2px solid #facc15; box-shadow: 0 4px 12px rgba(250,204,21,0.2);">${simDepthText}</div>
                `
                    : ""
                }
              </div>
              <div style="font-size:11px; color:#94a3b8; font-weight:500;">Rủi ro: ${Math.round(simScore * 100)}% ${delta > 0 ? `<span style="color:#ef4444;">(+${delta}%)</span>` : ""}</div>
            </div>
          `;

          return (
            <div
              key={base.id}
              onClick={() => setFocusPoint({ lat: base.lat, lng: base.lng, popupHtml, zoom: 15 })}
              className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors group"
            >
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-xs font-semibold truncate group-hover:text-blue-400 transition-colors">{base.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">Rủi ro: {Math.round(simScore * 100)}%</span>
                  {delta !== 0 && (
                    <span className={`text-[10px] font-bold ${delta > 0 ? "text-red-400" : "text-green-400"}`}>
                      {delta > 0 ? `+${delta}%` : `${delta}%`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-background/50 rounded-md px-1.5 py-0.5 border border-border/50">
                  <span className="text-[11px] text-muted-foreground">{baseDepthText}</span>
                  {hasChanged && (
                    <>
                      <span className="mx-1 text-[10px] text-muted-foreground">→</span>
                      <span className="text-xs font-bold" style={{ color: simColor }}>
                        {simDepthText}
                      </span>
                    </>
                  )}
                </div>
                <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: simColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FloodSimPreview({ result }: { result?: SimulationResult }) {
  const { data } = useFloodRisk();
  const tr = useTranslations("risk");
  const sp = useTranslations("simulation.preview");
  if (!data) return null;

  const baseScore = data.riskScore;
  // DP3: before a backend result lands, show the baseline unchanged — never a locally
  // recomputed score. Once /api/simulation has responded, use its own before/after.
  const simScore = result?.comparison ? result.comparison.after.riskScore : baseScore;
  const delta = Math.round((simScore - baseScore) * 100);
  const baseLbl = riskLabel(baseScore, tr);
  const simLbl = riskLabel(simScore, tr);

  const { currentRainfall: rainfall, terrainSensitivity: terrain, imperviousness, drainageCapacity: drainage } = data.triggers;

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden shadow-inner">
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex justify-between items-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sp("floodTitle")}</p>
        {delta !== 0 && (
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${delta > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
            {delta > 0 ? `+${delta}% rủi ro` : `${delta}% rủi ro`}
          </div>
        )}
      </div>

      <div className="flex items-center justify-around px-2 py-4 relative">
        <div className="flex flex-col items-center gap-2">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/20 to-transparent rounded-full blur opacity-50" />
            <div
              className="relative w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 shadow-lg"
              style={{ background: riskBarColor(baseScore) + "15", color: riskBarColor(baseScore), borderColor: riskBarColor(baseScore) + "40" }}
            >
              <span className="text-xl font-black leading-none">{Math.round(baseScore * 100)}</span>
              <span className="text-[9px] font-medium opacity-80 mt-1 uppercase">Score</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{sp("current")}</p>
            <p className={`text-[11px] font-bold ${baseLbl.cls} px-2 py-0.5 rounded mt-1`}>{baseLbl.text}</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center h-full w-8">
          <div className={`w-full h-0.5 rounded-full ${delta > 0 ? "bg-red-500/20" : delta < 0 ? "bg-green-500/20" : "bg-border"}`} />
          <div className="mt-1">
            {delta > 0 ? <TrendingUp className="h-4 w-4 text-red-400" /> : delta < 0 ? <TrendingDown className="h-4 w-4 text-green-400" /> : <Minus className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            {delta !== 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse z-10 border-2 border-background" />}
            <div
              className="relative w-16 h-16 rounded-full flex flex-col items-center justify-center border-2 shadow-xl ring-2 ring-yellow-400/20"
              style={{ background: riskBarColor(simScore) + "25", color: riskBarColor(simScore), borderColor: riskBarColor(simScore) }}
            >
              <span className="text-xl font-black leading-none">{Math.round(simScore * 100)}</span>
              <span className="text-[9px] font-medium opacity-80 mt-1 uppercase">Sim</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{sp("simulated")}</p>
            <p className={`text-[11px] font-bold ${simLbl.cls} px-2 py-0.5 rounded mt-1`}>{simLbl.text}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card/20 px-3 py-2.5">
        <div className="grid grid-cols-1 gap-2">
          {[
            { icon: <Droplets className="h-3 w-3" />, label: sp("rainfall"), value: rainfall.toFixed(1), unit: "mm/h", color: "text-blue-400" },
            { icon: <span className="text-[8px] text-amber-500">T</span>, label: sp("terrain"), value: Math.round(terrain * 100), unit: "%", color: "text-amber-400" },
            { icon: <span className="text-[8px] text-orange-500">I</span>, label: sp("imperviousness"), value: Math.round(imperviousness * 100), unit: "%", color: "text-orange-400" },
            { icon: <span className="text-[8px] text-green-500">D</span>, label: sp("drainage"), value: Math.round(drainage * 100), unit: "%", color: "text-green-400" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded bg-background border border-border/50 ${item.color}`}>{item.icon}</div>
                <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              </div>
              <span className="text-[11px] text-muted-foreground/70">
                {item.value}
                {item.unit}
              </span>
            </div>
          ))}
        </div>
      </div>

      <FloodAreasList result={result} />
    </div>
  );
}

interface FloodSidebarProps {
  result?: SimulationResult;
  isPending: boolean;
  onRun: () => void;
  onReset: () => void;
}

export function FloodSidebar({ result, isPending, onRun, onReset }: FloodSidebarProps) {
  const ts = useTranslations("simulation");
  const sc = useTranslations("simulation.scenarios");
  const sl = useTranslations("simulation.sliders");
  const { params, setParams } = useSimulationStore();

  return (
    <SidebarShell title={ts("titleFlood")} icon={<Droplets className="h-4 w-4 text-blue-400" />} collapsedIcons={<Droplets className="h-4 w-4" />}>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <p className="text-xs text-muted-foreground">{ts("floodDesc")}</p>

        <FloodSimPreview result={result} />
        <ScenarioRecommendations result={result} />

        <RainfallSlider
          label={sl("rainfall")}
          value={Math.round(params.rainfallMultiplier * 100)}
          min={0}
          max={300}
          step={5}
          unit="%"
          onChange={(v) => setParams({ rainfallMultiplier: v / 100 })}
          description={sl("rainfallDesc")}
        />
        <GreenCoverageSlider description={sl("greenCoverageFloodDesc")} />

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{ts("quickScenario")}</label>
          <div className="grid grid-cols-1 gap-1.5">
            {[
              // gc undefined = green cover left at the served G₀
              { label: sc("floodLight"), rf: 1.5, gc: undefined },
              { label: sc("floodHeavy"), rf: 2.5, gc: undefined },
              { label: sc("floodExtreme"), rf: 3.0, gc: undefined },
              { label: sc("floodGreen"), rf: 1.0, gc: 0.6 },
              { label: sc("floodGreenHeavy"), rf: 2.0, gc: 0.6 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => setParams({ rainfallMultiplier: p.rf, greenCoverage: p.gc })}
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
        <ComparePanel scenario="flood" result={result} />
      </div>
    </SidebarShell>
  );
}
