import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, HelpCircle, X } from "lucide-react";
import { useTranslations } from "use-intl";
import type { SimulationResult } from "@/shared/types/simulation";

type ScenarioKind = "flood" | "heat" | "aqi";

const SCENARIO_ICON: Record<ScenarioKind, { emoji: string }> = {
  flood: { emoji: "\u{1F4A7}" },
  heat: { emoji: "\u{1F321}️" },
  aqi: { emoji: "\u{1F4A8}" },
};

function InfoModal({ scenario, onClose }: { scenario: ScenarioKind; onClose: () => void }) {
  const cp = useTranslations("comparePanel");
  const sr = useTranslations("simulation.results");

  const SCENARIO_INFO: Record<
    ScenarioKind,
    { title: string; intro: string; items: { label: string; desc: string; formula?: string }[] }
  > = {
    flood: {
      title: cp("floodTitle"),
      intro: cp("floodIntro"),
      items: [
        { label: cp("floodRiskBefore"), desc: cp("floodRiskBeforeDesc"), formula: cp("floodRiskFormula") },
        { label: cp("affectedAreas"), desc: cp("affectedAreasDesc") },
      ],
    },
    heat: {
      title: cp("heatTitle"),
      intro: cp("heatIntro"),
      items: [
        { label: cp("tempDelta"), desc: cp("tempDeltaDesc"), formula: cp("tempFormula") },
        { label: cp("floodRiskImpact"), desc: cp("floodRiskImpactDesc") },
      ],
    },
    aqi: {
      title: cp("aqiTitle"),
      intro: cp("aqiIntro"),
      items: [
        { label: cp("aqiDelta"), desc: cp("aqiDeltaDesc"), formula: cp("aqiFormula") },
        { label: cp("tempDeltaAqi"), desc: cp("tempDeltaAqiDesc") },
      ],
    },
  };

  const info = SCENARIO_INFO[scenario];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{SCENARIO_ICON[scenario].emoji}</span>
            <div>
              <p className="text-sm font-semibold">{info.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{info.intro}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="w-full h-px bg-border shrink-0" />

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {info.items.map((item, i) => (
            <div key={item.label} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/30">
                <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-xs font-semibold text-foreground">{item.label}</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                {item.formula && (
                  <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border/60">
                    <span className="text-[10px] font-bold text-primary mt-0.5 shrink-0">f(x)</span>
                    <p className="text-[11px] font-mono text-foreground leading-relaxed">{item.formula}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {sr("understood")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Delta({ value, reverseColors = false, unit = "" }: { value: number; reverseColors?: boolean; unit?: string }) {
  const isNeutral = value === 0;
  const isPos = value > 0;
  const color = isNeutral
    ? "text-muted-foreground"
    : reverseColors
      ? isPos
        ? "text-red-400"
        : "text-green-400"
      : isPos
        ? "text-green-400"
        : "text-red-400";

  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {isNeutral ? <Minus className="h-3 w-3" /> : isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isNeutral ? "—" : `${isPos ? "+" : ""}${value.toFixed(1)}${unit}`}
    </span>
  );
}

function StatBox({
  label,
  value,
  delta,
  reverseColors = true,
  unit = "",
}: {
  label: string;
  value: string;
  delta?: number | null;
  reverseColors?: boolean;
  unit?: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-1">
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className="text-base font-bold">{value}</p>
      {delta != null && <Delta value={delta} reverseColors={reverseColors} unit={unit} />}
    </div>
  );
}

interface ComparePanelProps {
  scenario: ScenarioKind;
  /** Mutation data from useSimulation() — the page owns it, this panel never reads a
   *  store for it (DP3: it renders what the backend computed, nothing recomputed here). */
  result?: SimulationResult;
}

export function ComparePanel({ scenario, result }: ComparePanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const sr = useTranslations("simulation.results");

  if (!result) return null;

  const r = result.results;
  const cmp = result.comparison;

  // B-016: S-002 removed affectedPopulation / affectedBuildings from the API (they were the
  // Stage-1 heuristic 50k/80k people and 1,200 buildings per affected zone, not
  // an exposure model). Population exposure is Stage 2 (Decision 2026-09-14): never rendered.
  const floodMetrics = [
    {
      label: sr("floodRiskBefore"),
      value: cmp ? `${(cmp.before.riskScore * 100).toFixed(0)}%` : "—",
      delta: cmp ? (cmp.after.riskScore - cmp.before.riskScore) * 100 : null,
      reverseColors: true,
      unit: "%",
    },
    {
      label: sr("affectedAreas"),
      value: cmp ? `${cmp.before.affectedAreas} → ${cmp.after.affectedAreas}` : "—",
      delta: cmp ? cmp.after.affectedAreas - cmp.before.affectedAreas : null,
      reverseColors: true,
      unit: "",
    },
  ];

  const heatMetrics = [
    {
      label: sr("tempDelta"),
      value: r ? `${r.tempDelta > 0 ? "+" : ""}${r.tempDelta.toFixed(1)}°C` : "—",
      delta: r?.tempDelta ?? null,
      reverseColors: true,
      unit: "°C",
    },
    {
      label: sr("floodRiskImpact"),
      value: cmp ? `${(cmp.before.riskScore * 100).toFixed(0)}% → ${(cmp.after.riskScore * 100).toFixed(0)}%` : "—",
      delta: cmp ? (cmp.after.riskScore - cmp.before.riskScore) * 100 : null,
      reverseColors: true,
      unit: "%",
    },
  ];

  const aqiMetrics = [
    {
      label: sr("aqiDelta"),
      value: r ? `${r.aqiDelta > 0 ? "+" : ""}${r.aqiDelta.toFixed(0)}` : "—",
      delta: r?.aqiDelta ?? null,
      reverseColors: true,
      unit: "",
    },
    {
      label: sr("tempDelta"),
      value: r ? `${r.tempDelta > 0 ? "+" : ""}${r.tempDelta.toFixed(1)}°C` : "—",
      delta: r?.tempDelta ?? null,
      reverseColors: true,
      unit: "°C",
    },
  ];

  const metrics = scenario === "flood" ? floodMetrics : scenario === "heat" ? heatMetrics : aqiMetrics;

  return (
    <>
      {showInfo && <InfoModal scenario={scenario} onClose={() => setShowInfo(false)} />}

      <Card className="mt-3 border-border/60">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {sr("title")}
            </CardTitle>
            <button
              onClick={() => setShowInfo(true)}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={sr("explainBtn")}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="grid grid-cols-2 gap-2">
            {metrics.map(({ label, value, delta, reverseColors, unit }) => (
              <StatBox key={label} label={label} value={value} delta={delta} reverseColors={reverseColors} unit={unit} />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
