import { useTranslations } from "use-intl";
import type { FloodTerm } from "@/shared/types/flood";

const SYMBOL: Record<FloodTerm["key"], string> = {
  rainfall: "w₁·P̃",
  terrain: "w₂·T̃",
  imperviousness: "w₃·Ĩ",
  drainage: "−w₄·D̃",
};

/**
 * R_f = w₁·P̃ + w₂·T̃ + w₃·Ĩ − w₄·D̃, rendered from the terms climate SERVES (§B, B-014): every
 * weight, x̃ and contribution comes from the payload, the web holds no PDIM coefficient.
 * Every term is shown with its weight and the drainage term is drawn in the opposite
 * direction (Decision 2026-09-14, B-010).
 */
export function RiskDecomposition({
  terms,
  score,
  rainfall,
}: {
  terms: FloodTerm[];
  /** The served (clamped) R_f the terms explain. */
  score: number;
  /** P in mm/h at the unit (or city centre), shown next to P̃. */
  rainfall?: number;
}) {
  const fp = useTranslations("floodPage");
  const sum = terms.reduce((s, t) => s + t.contribution, 0);
  const clamped = Math.abs(sum - score) > 0.001;
  const scale = Math.max(...terms.map((t) => Math.abs(t.contribution)), 0.01);

  const META: Record<FloodTerm["key"], { label: string; note: string }> = {
    rainfall: { label: fp("trigRainfall"), note: fp("rainfallNote") },
    terrain: { label: fp("trigTerrain"), note: fp("terrainNote") },
    imperviousness: { label: fp("trigImperviousness"), note: fp("imperviousnessNote") },
    drainage: { label: fp("trigDrainage"), note: fp("drainageNote") },
  };

  return (
    <div className="space-y-4">
      {terms.map((t) => {
        const meta = META[t.key];
        // Drainage is the subtractive term; the served contribution is already negative.
        const negative = t.key === "drainage" || t.contribution < 0;
        const width = (Math.abs(t.contribution) / scale) * 100;
        return (
          <div key={t.key} data-testid={`term-${t.key}`} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-medium">{meta.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground shrink-0">{SYMBOL[t.key]}</span>
              </div>
              <div className="flex items-baseline gap-2 shrink-0 font-mono text-xs">
                <span className="text-muted-foreground">
                  {t.key === "rainfall" && rainfall != null && `${rainfall.toFixed(1)} mm/h · `}
                  {fp("normalizedIs", { x: t.normalized.toFixed(3) })}
                </span>
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
                {negative && (
                  <div data-direction="left" className="h-2 rounded-l bg-emerald-500/70" style={{ width: `${width}%` }} />
                )}
              </div>
              <div className="w-px h-3 bg-border shrink-0" />
              <div className="flex w-1/2">
                {!negative && (
                  <div data-direction="right" className="h-2 rounded-r bg-blue-500/70" style={{ width: `${width}%` }} />
                )}
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
