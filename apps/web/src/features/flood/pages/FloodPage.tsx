import { useState } from "react";
import { useTranslations } from "use-intl";
import { Droplets, MapPin, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { RiskBadge } from "@/shared/components/common/RiskBadge";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { DataSourceTag } from "@/shared/components/common/DataSourceTag";
import type { RiskLevel } from "@/shared/constants/riskLevels";
import { RiskDecomposition } from "@/features/flood/components/RiskDecomposition";
import { HazardRecommendations } from "@/shared/components/hazards/HazardRecommendations";
import { HazardAlerts } from "@/shared/components/hazards/HazardAlerts";

export default function FloodPage() {
  const { data, isLoading, isError, refetch } = useFloodRisk();
  const fp = useTranslations("floodPage");
  const c = useTranslations("cards");
  // null = the city-level decomposition; otherwise the id of the zone picked in the table.
  const [zoneId, setZoneId] = useState<string | null>(null);
  const zone = data?.affectedAreas.find((a) => a.id === zoneId);

  return (
    <div className="h-full overflow-y-auto">
    <div className="space-y-5 max-w-6xl mx-auto p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{fp("title")}</h1>
          <p className="text-sm text-muted-foreground">{fp("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <DataSourceTag source={fp("source")} />
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
                      <th className="text-right py-2 text-muted-foreground font-medium">{fp("colRain")}</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">{fp("colDepth")}</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">{fp("colScore")}</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">{fp("colLevel")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.affectedAreas.map((area) => (
                      <tr
                        key={area.id}
                        onClick={() => setZoneId(area.id)}
                        aria-selected={area.id === zoneId}
                        className={`border-b border-border/30 cursor-pointer hover:bg-muted/20 ${area.id === zoneId ? "bg-muted/30" : ""}`}
                      >
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {area.name}
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted-foreground">{area.rainfall.toFixed(1)}</td>
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
                        <td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">
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
              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <span className="font-medium">{zone ? zone.name : fp("decompCity")}</span>
                {zone ? (
                  <button type="button" onClick={() => setZoneId(null)} className="text-muted-foreground hover:text-foreground">
                    {fp("backToCity")}
                  </button>
                ) : (
                  <span className="text-muted-foreground">{fp("decompPick")}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {zone ? (
                <RiskDecomposition terms={zone.decomposition} score={zone.riskScore} rainfall={zone.rainfall} />
              ) : (
                <RiskDecomposition terms={data.decomposition} score={data.riskScore} rainfall={data.triggers.currentRainfall} />
              )}
            </CardContent>
          </Card>

          <HazardAlerts hazard="flood" />
          <HazardRecommendations category="flood" />

          <p className="text-xs text-muted-foreground">{fp("screeningNote")}</p>
        </>
      )}
    </div>
    </div>
  );
}
