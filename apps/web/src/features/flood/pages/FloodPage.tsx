import { useTranslations } from "use-intl";
import { Droplets, MapPin, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { RiskBadge } from "@/shared/components/common/RiskBadge";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { DataSourceTag } from "@/shared/components/common/DataSourceTag";
import type { RiskLevel } from "@/shared/constants/riskLevels";
import type { FloodData } from "@/shared/types/flood";
import { RiskDecomposition } from "@/features/flood/components/RiskDecomposition";

/** New climate-service `/latest` payloads may carry these; the legacy backend never
 *  sends them, so every read below is optional. */
type WithFreshness<T> = T & { observedAt?: string; stale?: boolean };

export default function FloodPage() {
  const { data, isLoading, isError, refetch } = useFloodRisk();
  const fp = useTranslations("floodPage");
  const c = useTranslations("cards");
  const fresh = data as WithFreshness<FloodData> | undefined;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{fp("title")}</h1>
          <p className="text-sm text-muted-foreground">{fp("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <DataSourceTag source={fp("source")} />
          {fresh?.stale && (
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
                <Droplets className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-3xl font-bold">
                    {(data.riskScore * 100).toFixed(0)}
                    <span className="text-base font-normal text-muted-foreground ml-1">/100</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{fp("scoreLabel")}</p>
                </div>
              </div>
              <div className="sm:ml-4">
                <RiskBadge level={data.overallRisk as RiskLevel} />
              </div>
              <div className="sm:ml-auto flex gap-6">
                <div className="text-center">
                  <p className="text-lg font-semibold">{data.affectedAreas?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{fp("affectedAreas")}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{data.triggers?.currentRainfall?.toFixed(1) ?? "--"}</p>
                  <p className="text-xs text-muted-foreground">{fp("rainfallCurrent")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{fp("dangerZones")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">{fp("colArea")}</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">{fp("colDepth")}</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">{fp("colScore")}</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">{fp("colLevel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.affectedAreas.map((area) => (
                      <tr key={area.id} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {area.name}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          <span className="flex items-center justify-end gap-1">
                            <ArrowUp className="h-3 w-3" />
                            {area.estimatedDepth.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {(area.riskScore * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 text-center">
                          <RiskBadge level={area.riskLevel} />
                        </td>
                      </tr>
                    ))}
                    {data.affectedAreas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-muted-foreground text-sm">
                          {fp("noZones")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{fp("triggers")}</CardTitle>
              <p className="text-xs text-muted-foreground">{fp("triggersSub")}</p>
            </CardHeader>
            <CardContent>
              {data.triggers && <RiskDecomposition triggers={data.triggers} score={data.riskScore} />}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{fp("screeningNote")}</p>
        </>
      )}
    </div>
  );
}
