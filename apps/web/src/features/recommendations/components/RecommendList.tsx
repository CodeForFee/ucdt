import { useTranslations } from "use-intl";
import { ListChecks, Droplets, Wind, Thermometer, AlertOctagon, ChevronRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Recommendation, RecommendationInputs } from "@/shared/types/recommend";

const CATEGORY_ICONS: Record<Recommendation["category"], React.ComponentType<{ className?: string }>> = {
  flood: Droplets,
  air: Wind,
  heat: Thermometer,
  combined: AlertOctagon,
};

const PRIORITY_STYLES: Record<Recommendation["priority"], string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-orange-500/20 text-orange-400",
  urgent: "bg-red-500/20 text-red-400",
};

/** The inputs a rule fired on, in display order. `aqiPointId` (an internal join key to the
 *  paired AQI point, §A.4) is data, not a value, and is not shown. */
const INPUT_KEYS = ["riskScore", "rainfall", "aqi", "effectiveTemperature", "severityBand", "exposureE", "feasibilityFa"] as const;

function formatInput(value: unknown): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

/**
 * Rule provenance (B-005, §E, §J): every ranked item names the unit's toponym, the rule
 * that fired, π(r, i) and the inputs that rule saw. `commune` is carried by the payload but
 * NEVER rendered (§A.3): readers would take "Phường Bình Thạnh" for the abolished district.
 */
function InputsList({ inputs }: { inputs: RecommendationInputs }) {
  const t = useTranslations("recInputs");
  const bt = useTranslations("bands");
  const r = useTranslations("recommendations");
  const rows = INPUT_KEYS.filter((k) => inputs[k] != null);
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 rounded-md bg-background/60 p-2">
    <p className="mb-1 text-[11px] font-medium text-muted-foreground">{r("whyThis")}</p>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
      {rows.map((k) => {
        const v = inputs[k];
        const shown = k === "severityBand" && typeof v === "string" && bt.has(v) ? bt(v) : formatInput(v);
        return (
          <div key={k} className="flex justify-between gap-2 min-w-0">
            <dt className="text-muted-foreground truncate">{t(k)}</dt>
            <dd className="font-mono shrink-0">{shown}</dd>
          </div>
        );
      })}
    </dl>
    </div>
  );
}

function RecommendCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const Icon = CATEGORY_ICONS[rec.category] ?? ListChecks;
  const r = useTranslations("risk");
  const d = useTranslations("recommendations");
  const uk = useTranslations("unitKind");

  const PRIORITY_LABELS: Record<Recommendation["priority"], string> = {
    low: r("low"),
    medium: r("medium"),
    high: r("high"),
    urgent: r("urgent"),
  };

  return (
    <li className="flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="text-[10px] font-mono text-muted-foreground">#{rank}</span>
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug flex items-center gap-1 min-w-0">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{rec.unitName}</span>
            <span className="text-[10px] font-normal text-muted-foreground shrink-0">· {uk(rec.unitKind)}</span>
          </p>
          <Badge className={`shrink-0 text-[10px] px-1.5 ${PRIORITY_STYLES[rec.priority]}`}>
            {PRIORITY_LABELS[rec.priority]}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          <span className="font-mono" title={d("priorityScore")}>
            π = {rec.priorityScore.toFixed(2)}
          </span>
          <span className="text-border">·</span>
          <span className="font-mono" title={d("rule")}>
            {rec.ruleId}
          </span>
          <span className="text-border">·</span>
          <span className="truncate">{rec.title}</span>
        </div>

        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.message}</p>

        {rec.actionItems.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {rec.actionItems.map((action, i) => (
              <li key={i} className="flex items-start gap-1 text-xs text-muted-foreground">
                <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        )}

        <InputsList inputs={rec.inputs} />
      </div>
    </li>
  );
}

export function RecommendList({ recommendations, firedCount }: { recommendations: Recommendation[]; firedCount: number }) {
  const d = useTranslations("recommendations");
  if (recommendations.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">{d("noRecommend")}</p>;
  }
  return (
    <>
      {/* firedCount 0 = only the R-NORM-00 default-state item (π = 0), not a fired rule. */}
      {firedCount > 0 && (
        <p className="text-[11px] text-muted-foreground mb-2">{d("firedCount", { shown: recommendations.length, fired: firedCount })}</p>
      )}
      <ol className="space-y-3">
        {recommendations.map((rec, i) => (
          <RecommendCard key={rec.id} rec={rec} rank={i + 1} />
        ))}
      </ol>
    </>
  );
}
