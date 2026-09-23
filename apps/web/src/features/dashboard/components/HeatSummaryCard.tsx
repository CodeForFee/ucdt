import { Link } from "react-router-dom";
import { useTranslations } from "use-intl";
import { ChevronRight, Flame, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { useHeatMap } from "@/shared/hooks/useHeatMap";

export function HeatSummaryCard() {
  const { data, isLoading } = useHeatMap();
  const c = useTranslations("cards");

  const hotTop = data?.hotspots?.slice().sort((a, b) => b.temperature - a.temperature).slice(0, 4) ?? [];

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          {c("temperature")}
        </CardTitle>
        <Link
          to="/simulation/heat"
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
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">{data?.avgTemperature?.toFixed(1) ?? "--"}°</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c("avgTemp")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{data?.maxTemperature?.toFixed(1) ?? "--"}°</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c("maxTemp")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">+{data?.heatIslandIntensity?.toFixed(1) ?? "--"}°</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c("uhiEffect")}</p>
              </div>
            </div>
            {hotTop.length > 0 && (
              <div className="space-y-1.5 pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  {c("hotspot")}
                </p>
                {hotTop.map((h) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1 text-muted-foreground">{h.name}</span>
                    <span className="text-xs font-mono font-semibold text-orange-400">{h.temperature.toFixed(1)}°C</span>
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-red-500"
                        style={{ width: `${Math.min(100, h.intensity * 100)}%` }}
                      />
                    </div>
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
