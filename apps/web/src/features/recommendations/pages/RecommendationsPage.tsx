import { useTranslations } from "use-intl";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecommend } from "@/shared/hooks/useRecommend";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { RecommendList } from "@/shared/components/hazards/RecommendList";

/** Ranked recommendations (§E, §J) on their own tab: the full top-k by π(r, i) with the
 *  toponym, rule, π and the rule's inputs, plus the firedCount note. */
export default function RecommendationsPage() {
  const { data, isLoading, isError, refetch } = useRecommend();
  const r = useTranslations("recommendations");

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5 max-w-4xl mx-auto p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold">{r("title")}</h1>
          <p className="text-sm text-muted-foreground">{r("subtitle")}</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-yellow-400" />
              {r("listTitle")}
            </CardTitle>
            {/* The engine is a transparent rule base, not a model (B-005). */}
            <p className="text-[11px] text-muted-foreground">{r("ruleBasedNote")}</p>
          </CardHeader>
          <CardContent>
            {isLoading && <LoadingSkeleton count={3} variant="list" />}
            {isError && <ErrorState compact onRetry={() => refetch()} />}
            {data && <RecommendList recommendations={data.recommendations ?? []} firedCount={data.firedCount} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
