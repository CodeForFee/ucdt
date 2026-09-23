import { useTranslations } from "use-intl";
import type { FloodTriggers } from "@/shared/types/flood";
import { decomposeFloodRisk, FLOOD_WEIGHTS, type DecompositionTerm } from "@/features/flood/lib/decomposeFloodRisk";

export function RiskDecomposition({
  triggers,
  score,
}: {
  triggers: FloodTriggers;
  score: number;
}) {
  const fp = useTranslations("floodPage");
  const { terms, sum } = decomposeFloodRisk(triggers);
  const clamped = Math.abs(sum - score) > 0.001;
  const scale = Math.max(...terms.map((t) => Math.abs(t.contribution)), 0.01);

  const LABELS: Record<DecompositionTerm["key"], { label: string; symbol: string; raw: string; note: string }> = {
    rainfall: {
      label: fp("trigRainfall"),
      symbol: "w₁·P̃",
      raw: `${triggers.currentRainfall.toFixed(1)} mm/h`,
      note: fp("refBound", { value: FLOOD_WEIGHTS.rainRefMmH }),
    },
    terrain: {
      label: fp("trigTerrain"),
      symbol: "w₂·T̃",
      raw: terms[1].raw.toFixed(2),
      note: fp("terrainNote"),
    },
    soil: {
      label: fp("trigSoil"),
      symbol: "w₃·Ĩ",
      raw: `${(terms[2].raw * 100).toFixed(0)}%`,
      note: fp("soilNote"),
    },
    drainage: {
      label: fp("trigDrainage"),
      symbol: "−w₄·D̃",
      raw: `${(terms[3].raw * 100).toFixed(0)}%`,
      note: fp("drainageNote"),
    },
  };

  return (
    <div className="space-y-4">
      {terms.map((t) => {
        const meta = LABELS[t.key];
        const negative = t.contribution < 0;
        const width = (Math.abs(t.contribution) / scale) * 100;
        return (
          <div key={t.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-medium">{meta.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">{meta.symbol}</span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0 font-mono text-xs">
                <span className="text-muted-foreground">{meta.raw}</span>
                <span className="text-muted-foreground">→</span>
                <span className={negative ? "text-emerald-400" : "text-foreground"}>
                  {negative ? "−" : "+"}
                  {Math.abs(t.contribution).toFixed(3)}
                </span>
              </div>
            </div>

            {/* Aggravating terms grow right from the centre line, the mitigating drainage
                term grows left, so the sign reads at a glance (B-010). */}
            <div className="flex h-2 items-center">
              <div className="flex w-1/2 justify-end">
                {negative && <div className="h-2 rounded-l bg-emerald-500/70" style={{ width: `${width}%` }} />}
              </div>
              <div className="w-px h-3 bg-border shrink-0" />
              <div className="flex w-1/2">
                {!negative && <div className="h-2 rounded-r bg-blue-500/70" style={{ width: `${width}%` }} />}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {fp("weightIs", { w: t.weight.toFixed(2) })} · {meta.note}
            </p>
          </div>
        );
      })}

      <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
        <span className="font-medium">{fp("sumLabel")}</span>
        <span className="font-mono">
          {sum.toFixed(3)}
          {clamped && (
            <span className="text-muted-foreground">
              {" "}
              → {score.toFixed(3)} {fp("clamped")}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
