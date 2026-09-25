import { useTranslations } from "use-intl";
import { Lightbulb } from "lucide-react";
import type { BandChange, SimulationResult } from "@/shared/types/simulation";

const HAZARDS = ["flood", "heat", "aqi"] as const;

/**
 * "Khuyến nghị cho kịch bản" (spec §G, §J): Algorithm 2 steps 3–6 re-run by climate on the
 * counterfactual state — the ranked top-k, the per-unit band changes and the alerts that
 * WOULD fire. Everything is rendered as served; nothing is recomputed here (DP3). Units are
 * named by toponym only; `commune` is never rendered (§A.3).
 */
export function ScenarioRecommendations({ result, showStations = false }: { result?: SimulationResult; showStations?: boolean }) {
  const t = useTranslations("scenarioRec");
  const bt = useTranslations("bands");

  if (!result?.counterfactual) return null;
  const { recommendations, firedCount, alerts, bandChanges } = result.counterfactual;
  const band = (code: string) => (bt.has(code) ? bt(code) : code);
  const changes: Array<BandChange & { hazard: (typeof HAZARDS)[number] }> = HAZARDS.flatMap((h) =>
    (bandChanges[h] ?? []).map((c) => ({ ...c, hazard: h })),
  );
  const stations = result.results.stations ?? [];

  return (
    <section aria-label={t("title")} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("title")}</h2>
      </div>

      <div className="px-3 py-2 space-y-3 text-xs">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">
            {t("topK", { shown: recommendations.length, fired: firedCount })}
          </p>
          {recommendations.length === 0 || firedCount === 0 ? (
            <p className="text-muted-foreground">{t("noRecs")}</p>
          ) : (
            <ol className="space-y-1">
              {recommendations.map((r, i) => (
                <li key={r.id} className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="flex-1 min-w-0 truncate">{r.unitName}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="border-t border-border/60 pt-2">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">{t("bandChanges")}</p>
          {changes.length === 0 ? (
            <p className="text-muted-foreground">{t("noBandChanges")}</p>
          ) : (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {changes.map((c) => (
                <li key={`${c.hazard}:${c.unitId}`} className="flex items-baseline gap-2">
                  <span className="text-[10px] text-muted-foreground w-9 shrink-0">{t(`hazard.${c.hazard}`)}</span>
                  <span className="flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="shrink-0">
                    {band(c.before)} → <span className="font-semibold">{band(c.after)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 pt-2">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">{t("alerts")}</p>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground">{t("noAlerts")}</p>
          ) : (
            <ul className="space-y-1">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-baseline gap-2">
                  <span
                    className={`shrink-0 rounded px-1 text-[10px] font-semibold ${a.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}
                  >
                    {t(`severity.${a.severity}`)}
                  </span>
                  <span className="shrink-0 font-medium">{a.unitName}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{a.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showStations && stations.length > 0 && (
          <div className="border-t border-border/60 pt-2">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">{t("stations")}</p>
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {stations.map((s) => (
                <li key={s.id} className="flex items-baseline gap-2">
                  <span className="flex-1 min-w-0 truncate">{s.name}</span>
                  <span className="font-mono shrink-0">
                    {s.before} → {s.after}
                  </span>
                  <span
                    className={`font-mono text-[10px] w-8 text-right shrink-0 ${s.delta < 0 ? "text-green-400" : s.delta > 0 ? "text-red-400" : "text-muted-foreground"}`}
                  >
                    {s.delta > 0 ? `+${s.delta}` : s.delta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
