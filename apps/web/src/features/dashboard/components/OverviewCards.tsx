import { useTranslations } from "use-intl";
import { Thermometer, Wind, Droplets, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWeatherData } from "@/shared/hooks/useWeatherData";
import { useHistory } from "@/shared/hooks/useHistory";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { AQIGauge } from "@/shared/components/charts/AQIGauge";
import { RiskBadge } from "@/shared/components/common/RiskBadge";
import { TrendIndicator } from "@/shared/components/common/TrendIndicator";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { RISK_LEVELS, type RiskLevel } from "@/shared/constants/riskLevels";
import type { WeatherData } from "@/shared/types/weather";
import { weatherOutlook } from "@/features/dashboard/lib/weatherOutlook";

/** New climate-service `/latest` payloads may carry these; the legacy backend never
 *  sends them, so every read below is optional. */
type WithFreshness<T> = T & { observedAt?: string; stale?: boolean };

function StaleTag({ show, label }: { show: boolean | undefined; label: string }) {
  if (!show) return null;
  return (
    <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-400">{label}</span>
  );
}

export function OverviewCards() {
  const { data: weather, isLoading: wLoading } = useWeatherData();
  const { data: weatherHistory } = useHistory<WeatherData>("weather", 24);
  const { data: aqi, isLoading: aLoading } = useAQIData();
  const { data: flood, isLoading: fLoading } = useFloodRisk();
  const c = useTranslations("cards");

  if (wLoading || aLoading || fLoading) {
    return <LoadingSkeleton count={4} variant="card" />;
  }

  const outlook = weatherOutlook(weather?.current, weather?.forecast, weatherHistory);
  const floodLevel = (flood?.overallRisk ?? "low") as RiskLevel;
  const freshWeather = weather as WithFreshness<WeatherData> | undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* AQI Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wind className="h-4 w-4" />
            {c("airQuality")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 pt-0">
          <AQIGauge value={aqi?.aqi ?? 0} size={110} />
        </CardContent>
      </Card>

      {/* Temperature Card */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            {c("temperature")}
          </CardTitle>
          <StaleTag show={freshWeather?.stale} label={c("stale")} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{weather?.current?.temperature?.toFixed(1) ?? "--"}°C</div>
          <p className="text-xs text-muted-foreground mt-1">
            {c("feelsLike", { value: weather?.current?.feelsLike?.toFixed(1) ?? "--" })}
          </p>
          {outlook.tempDelta !== null && (
            <div className="mt-2 flex items-center gap-2">
              <TrendIndicator value={outlook.tempDelta} unit="°C" reverseColors />
              <span className="text-xs text-muted-foreground">
                {outlook.kind === "history" ? c("vs24hTemp") : c("next6hTemp")}
              </span>
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {c("humidity")}
            {weather?.current?.humidity ?? "--"}%{c("wind")}
            {weather?.current?.windSpeed?.toFixed(1) ?? "--"}
            {c("windUnit")}
          </div>
        </CardContent>
      </Card>

      {/* Rainfall Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            {c("rainfall")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {weather?.current?.rainfall?.toFixed(1) ?? "--"}{" "}
            <span className="text-base font-normal text-muted-foreground">{c("rainfallUnit")}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{c("lastHour")}</p>
          {outlook.rainValue !== null && (
            <div className="mt-2 flex items-center gap-2">
              <TrendIndicator value={outlook.rainValue} unit="mm" reverseColors />
              <span className="text-xs text-muted-foreground">
                {outlook.kind === "history" ? c("vs24hRain") : c("next6hRain")}
              </span>
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            {c("wind")}
            {weather?.current?.windSpeed?.toFixed(1) ?? "--"}
            {c("windUnit")} · {weather?.current?.condition ?? "--"}
          </div>
        </CardContent>
      </Card>

      {/* Flood Risk Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {c("floodRisk")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {((flood?.riskScore ?? 0) * 100).toFixed(0)}
            <span className="text-base font-normal text-muted-foreground">/100</span>
          </div>
          <div className="mt-2">
            <RiskBadge level={floodLevel} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {flood?.affectedAreas?.length ?? 0}
            {c("affectedAreas")}
          </div>
          <div className="mt-2 w-full bg-muted/40 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${((flood?.riskScore ?? 0) * 100).toFixed(0)}%`,
                background: RISK_LEVELS[floodLevel].color,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
