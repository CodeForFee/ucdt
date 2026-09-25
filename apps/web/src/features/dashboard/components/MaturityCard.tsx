import { useTranslations } from "use-intl";
import { Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMaturity } from "@/shared/hooks/useMaturity";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { formatDateTime } from "@/shared/lib/formatters";
import type { GammaEstimate, HazardMaturity, MaturityResponse } from "@/shared/types/maturity";

const STAGES = ["S1", "S2", "S3"] as const;

const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

function Gamma({ label, g }: { label: string; g: GammaEstimate }) {
  const [lo, hi] = g.ci95;
  return (
    <span className="font-mono">
      {label} = {g.value.toFixed(3)} [{lo.toFixed(3)}, {hi.toFixed(3)}]
    </span>
  );
}

function HazardRow({ h }: { h: HazardMaturity }) {
  const t = useTranslations("maturity");
  const criterion = (name: string) => (t.has(`criteria.${name}`) ? t(`criteria.${name}`) : name);
  const formula = (s: (typeof STAGES)[number]) =>
    t.has(`formula.${h.hazard}.${s}`) ? t(`formula.${h.hazard}.${s}`) : null;

  return (
    <li className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3" data-testid={`maturity-${h.hazard}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t(`hazard.${h.hazard}`)}</span>
        <span className="flex items-center gap-1 text-[11px]">
          <span className="text-muted-foreground">{t("active")}</span>
          {STAGES.map((s) => (
            <span
              key={s}
              aria-current={s === h.active ? "step" : undefined}
              className={`rounded px-1.5 py-0.5 font-mono ${s === h.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {s}
            </span>
          ))}
        </span>
      </div>

      <ul className="space-y-1.5 text-[11px]">
        {STAGES.map((s) => {
          const stage = h.stages[s];
          return (
            <li key={s} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono w-5 shrink-0">{s}</span>
                <span className={stage.eligible ? "text-green-400" : "text-muted-foreground"}>
                  {stage.eligible ? t("eligible") : t("notEligible")}
                </span>
                {stage.criteria.length === 0 && <span className="text-muted-foreground">· {t("noCriteria")}</span>}
              </div>
              {formula(s) && <p className="ml-7 font-mono text-foreground/80">{formula(s)}</p>}
              {stage.criteria.map((c) => (
                <div key={c.name} className="ml-7 space-y-0.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground truncate">{criterion(c.name)}</span>
                    <span className="font-mono shrink-0">
                      {num(c.current)} / {num(c.required)}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.min(100, c.required > 0 ? (c.current / c.required) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
              {stage.reason && <p className="ml-7 text-muted-foreground italic">{stage.reason}</p>}
            </li>
          );
        })}
      </ul>

      {(h.s1MaeHoldout != null || h.s2) && (
        <div className="space-y-0.5 border-t border-border/50 pt-2 text-[11px]">
          {h.s1MaeHoldout != null && (
            <p>
              <span className="text-muted-foreground">{t("s1Mae")}: </span>
              <span className="font-mono">{h.s1MaeHoldout.toFixed(2)} AQI</span>
            </p>
          )}
          {h.s2 && (
            <>
              <p className="text-muted-foreground">{t("s2Fit")}</p>
              <p className="flex flex-wrap gap-x-3">
                <Gamma label="γ_w" g={h.s2.estimates.gammaWind} />
                <Gamma label="γ_p" g={h.s2.estimates.gammaRain} />
              </p>
              <p className="text-muted-foreground">
                {t("fitSize", { train: h.s2.nTrain, holdout: h.s2.nHoldout })}
                {h.s2.maeHoldout != null && (
                  <>
                    {" · "}
                    {t("s2Mae")}: <span className="font-mono text-foreground">{h.s2.maeHoldout.toFixed(2)} AQI</span>
                  </>
                )}
                {" · "}
                {h.s2.promoted ? t("promoted") : t("notPromoted")}
              </p>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function MaturityView({ data }: { data: MaturityResponse }) {
  const t = useTranslations("maturity");
  return (
    <>
      <ul className="space-y-3">
        {data.hazards.map((h) => (
          <HazardRow key={h.hazard} h={h} />
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground font-mono">
        {t("footer", { delta: data.deltaAqi, w: data.windowDays, at: formatDateTime(data.evaluatedAt) })}
      </p>
    </>
  );
}

/**
 * Algorithm 1 line 8 made visible (§H, §J; DP2/DP3): per hazard, the active stage, every
 * stage's criteria as current / required with the stated reason, the S1 holdout MAE where a
 * validation series exists, S2 estimates with 95 % CIs when fitted, and δ, W.
 */
export function MaturityCard() {
  const { data, isLoading, isError, refetch } = useMaturity();
  const t = useTranslations("maturity");

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          {t("title")}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">{t("subtitle")}</p>
        <p className="text-[11px] text-muted-foreground">{t("purpose")}</p>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading && <LoadingSkeleton count={3} variant="list" />}
        {isError && <ErrorState compact onRetry={() => refetch()} />}
        {data && <MaturityView data={data} />}
      </CardContent>
    </Card>
  );
}
