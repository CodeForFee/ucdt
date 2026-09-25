import { useTranslations } from "use-intl";
import { Thermometer, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHeatMap } from "@/shared/hooks/useHeatMap";
import { RiskBadge } from "@/shared/components/common/RiskBadge";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { DataSourceTag } from "@/shared/components/common/DataSourceTag";
import { heatRiskLevel } from "@/shared/lib/heatRisk";
import { HazardRecommendations } from "@/features/recommendations/components/HazardRecommendations";
import { HazardAlerts } from "@/features/alerts/components/HazardAlerts";

/** Mirrors FloodPage's layout (score card + per-unit table), merged under /risks with a
 *  hazard-filtered HazardRecommendations instead of a link out to a separate tab. */
export default function HeatPage() {
  const { data, isLoading, isError, refetch } = useHeatMap();
  const hp = useTranslations("heatPage");
  const c = useTranslations("cards");

  const cityLevel = data?.avgEffectiveTemperature != null ? heatRiskLevel(data.avgEffectiveTemperature) : "low";
  const hotCount = data?.hotspots?.filter((h) => heatRiskLevel(h.temperature) !== "low").length ?? 0;

  return (
    <div className="h-full overflow-y-auto">
    <div className="space-y-5 max-w-6xl mx-auto p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{hp("title")}</h1>
          <p className="text-sm text-muted-foreground">{hp("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <DataSourceTag source={hp("source")} />
          {data?.stale && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              {c("stale")}
            </span>
          )}
        </div>
      </div>

      {isLoading && <LoadingSkeleton count={4} variant="card" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          <Card>
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-5">
              <div className="flex items-center gap-3">
                <Thermometer className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-3xl font-bold">
                    {data.avgEffectiveTemperature?.toFixed(1) ?? "--"}
                    <span className="text-base font-normal text-muted-foreground ml-1">°C</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{hp("scoreLabel")}</p>
                </div>
              </div>
              <div className="sm:ml-4">
                <RiskBadge level={cityLevel} />
              </div>
              <div className="sm:ml-auto flex gap-6">
                <div className="text-center">
                  <p className="text-lg font-semibold">{hotCount}</p>
                  <p className="text-xs text-muted-foreground">{hp("affectedAreas")}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">+{data.heatIslandIntensity?.toFixed(1) ?? "--"}°</p>
                  <p className="text-xs text-muted-foreground">{hp("uhiEffect")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{hp("hotspots")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">{hp("colArea")}</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">{hp("colTemp")}</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">{hp("colLevel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hotspots.map((h) => (
                      <tr key={h.id} className="border-b border-border/30">
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {h.name}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted-foreground">{h.temperature.toFixed(1)}°C</td>
                        <td className="py-2.5 text-center">
                          <RiskBadge level={heatRiskLevel(h.temperature)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <HazardAlerts hazard="heat" />
          <HazardRecommendations category="heat" />
        </>
      )}
    </div>
    </div>
  );
}
