import { Link } from "react-router-dom";
import { useTranslations } from "use-intl";
import { Droplets, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { RiskBadge } from "@/shared/components/common/RiskBadge";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { RISK_LEVELS, type RiskLevel } from "@/shared/constants/riskLevels";

const pct = (x: number | undefined) => (x == null ? undefined : `${(x * 100).toFixed(0)}%`);

export function FloodSummaryCard() {
  const { data, isLoading } = useFloodRisk();
  const c = useTranslations("cards");

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-400" />
          {c("floodRisk")}
        </CardTitle>
        <Link
          to="/simulation/flood"
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          {c("simulate")} <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton count={1} variant="card" />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{c("overallScore")}</span>
                  <span className="text-sm font-bold">{((data?.riskScore ?? 0) * 100).toFixed(0)}/100</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(data?.riskScore ?? 0) * 100}%`,
                      background: RISK_LEVELS[(data?.overallRisk ?? "low") as RiskLevel].color,
                    }}
                  />
                </div>
              </div>
              <RiskBadge level={(data?.overallRisk ?? "low") as RiskLevel} />
            </div>

            {/* The four R_f inputs (city means), each named with its data source (DP3). */}
            <div className="grid grid-cols-4 gap-2 text-center mb-3">
              {[
                { value: data?.triggers?.currentRainfall?.toFixed(1), label: c("rainfallMM") },
                { value: pct(data?.triggers?.terrainSensitivity), label: c("terrain") },
                { value: pct(data?.triggers?.imperviousness), label: c("imperviousness") },
                { value: pct(data?.triggers?.drainageCapacity), label: c("drainage") },
              ].map((cell) => (
                <div key={cell.label} className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs font-mono font-semibold">{cell.value ?? "--"}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{cell.label}</p>
                </div>
              ))}
            </div>

            {(data?.affectedAreas?.length ?? 0) > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {c("affectedAreaCount")}
                  {data!.affectedAreas.length})
                </p>
                {data!.affectedAreas.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate flex-1 text-muted-foreground">{a.name}</span>
                    <span className="text-[10px] font-mono text-blue-400">{a.estimatedDepth.toFixed(2)}m</span>
                    <RiskBadge level={a.riskLevel} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
