import { Link } from "react-router-dom";
import { useTranslations } from "use-intl";
import { Wind, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AQIGauge } from "@/shared/components/charts/AQIGauge";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { aqiColor } from "@/shared/lib/aqi";

export function AQISummaryCard() {
  const { data, isLoading } = useAQIData();
  const c = useTranslations("cards");

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wind className="h-4 w-4 text-green-400" />
          {c("airQuality")}
        </CardTitle>
        <Link
          to="/simulation/aqi"
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          {c("simulate")} <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton count={1} variant="card" />
        ) : (
          <div className="flex items-center gap-4">
            <AQIGauge value={data?.aqi ?? 0} size={90} />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">{c("dominant")}</p>
                <p className="text-sm font-semibold">{data?.dominantPollutant ?? "PM2.5"}</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">PM2.5</span>
                <span className="font-mono font-medium">{data?.pm25 ?? "--"} µg/m³</span>
                <span className="text-muted-foreground">PM10</span>
                <span className="font-mono font-medium">{data?.pm10 ?? "--"} µg/m³</span>
                <span className="text-muted-foreground">O₃</span>
                <span className="font-mono font-medium">{data?.o3 ?? "--"} µg/m³</span>
                <span className="text-muted-foreground">NO₂</span>
                <span className="font-mono font-medium">{data?.no2 ?? "--"} µg/m³</span>
              </div>
            </div>
          </div>
        )}
        {(data?.stations?.length ?? 0) > 0 && (
          <div className="mt-3 space-y-1.5 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
              {c("stations")}
            </p>
            {data!.stations.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-xs truncate text-muted-foreground flex-1 mr-2">{s.name}</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ color: aqiColor(s.aqi), background: `${aqiColor(s.aqi)}33` }}
                >
                  AQI {s.aqi}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
