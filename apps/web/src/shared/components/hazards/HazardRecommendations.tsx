import { useTranslations } from "use-intl";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecommend } from "@/shared/hooks/useRecommend";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { RecommendList } from "@/shared/components/hazards/RecommendList";
import type { Recommendation } from "@/shared/types/recommend";

/**
 * The per-hazard risk pages (Flood/Heat/AQI, under /risks) embed this instead of linking out
 * to a separate Recommendations tab (merged per user request 2026-09-25 — see [[recommendations]]
 * commit history). `combined` (multi-hazard rules like R-COMB-01, and the R-NORM-00 default)
 * is included on every hazard's tab since it's relevant to more than one.
 */
export function HazardRecommendations({ category }: { category: Exclude<Recommendation["category"], "combined"> }) {
  const { data, isLoading, isError, refetch } = useRecommend();
  const r = useTranslations("recommendations");

  const filtered = data?.recommendations.filter((rec) => rec.category === category || rec.category === "combined") ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-yellow-400" />
          {r("listTitle")}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">{r("ruleBasedNote")}</p>
      </CardHeader>
      <CardContent>
        {isLoading && <LoadingSkeleton count={2} variant="list" />}
        {isError && <ErrorState compact onRetry={() => refetch()} />}
        {data && <RecommendList recommendations={filtered} firedCount={filtered.length} />}
      </CardContent>
    </Card>
  );
}
