import { useState } from "react";
import { useTranslations } from "use-intl";
import { ListChecks, Droplets, Wind, Thermometer, AlertOctagon, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRecommend } from "@/shared/hooks/useRecommend";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import type { Recommendation } from "@/shared/types/recommend";

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

/** Numbers render short; everything else as-is. */
function formatInput(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

/**
 * The rule provenance block (B-005): every ranked item must be traceable end to end — the
 * rule that produced it and the inputs that rule saw — so the API sends `ruleId`,
 * `priorityScore` and `inputs`, and this is where they surface instead of being dropped.
 */
function RuleProvenance({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false);
  const d = useTranslations("dashboard");
  const entries = Object.entries(rec.inputs ?? {});

  if (entries.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
        {d("whyThis")}
      </button>
      {open && (
        <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-background/60 p-2 text-[11px]">
          {entries.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 min-w-0">
              <dt className="text-muted-foreground truncate">{k}</dt>
              <dd className="font-mono shrink-0">{formatInput(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function RecommendCard({ rec }: { rec: Recommendation }) {
  const Icon = CATEGORY_ICONS[rec.category] ?? ListChecks;
  const r = useTranslations("risk");
  const d = useTranslations("dashboard");

  const PRIORITY_LABELS: Record<Recommendation["priority"], string> = {
    low: r("low"),
    medium: r("medium"),
    high: r("high"),
    urgent: r("urgent"),
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
      <div className="shrink-0 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug line-clamp-1">{rec.title}</p>
          <Badge className={`shrink-0 text-[10px] px-1.5 ${PRIORITY_STYLES[rec.priority]}`}>
            {PRIORITY_LABELS[rec.priority]}
          </Badge>
        </div>

        {/* Rank and originating rule, on the item itself — not buried. */}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
          <span className="font-mono" title={d("priorityScore")}>
            π = {rec.priorityScore.toFixed(2)}
          </span>
          <span className="text-border">·</span>
          <span className="font-mono" title={d("rule")}>
            {rec.ruleId}
          </span>
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

        <RuleProvenance rec={rec} />
      </div>
    </div>
  );
}

export function RecommendPanel() {
  const { data, isLoading, isError, refetch } = useRecommend();
  const d = useTranslations("dashboard");

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-yellow-400" />
          {d("aiRecommend")}
        </CardTitle>
        {/* The engine is a transparent rule base, not a model (B-005). */}
        <p className="text-[11px] text-muted-foreground">{d("ruleBasedNote")}</p>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-80">
        {isLoading && <LoadingSkeleton count={3} variant="list" />}
        {isError && <ErrorState compact onRetry={() => refetch()} />}
        {data && (
          <div className="space-y-3">
            {(data.recommendations ?? []).map((rec) => (
              <RecommendCard key={rec.id} rec={rec} />
            ))}
            {(data.recommendations ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{d("noRecommend")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
