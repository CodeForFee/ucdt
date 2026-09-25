import { useTranslations } from "use-intl";
import { Wind } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { AQIGauge } from "@/shared/components/charts/AQIGauge";
import { BarChart } from "@/shared/components/charts/BarChart";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { DataSourceTag } from "@/shared/components/common/DataSourceTag";
import { aqiCode, aqiColor } from "@/shared/lib/aqi";
import { formatDateTime } from "@/shared/lib/formatters";
import { HazardRecommendations } from "@/shared/components/hazards/HazardRecommendations";
import { HazardAlerts } from "@/shared/components/hazards/HazardAlerts";
import type { AQIData } from "@/shared/types/aqi";

/**
 * Open-monitoring-network stations (AirGradient, §I.3): MEASURED PM2.5 → US AQI, listed apart
 * from the modelled CAMS points. Each is paired with its nearest CAMS point (§A.4), shown by
 * that point's toponym.
 */
export function ObservedStationsList({ data }: { data: AQIData }) {
  const aq = useTranslations("airQualityPage");
  const aqiT = useTranslations("aqi");
  const pointName = new Map(data.stations.map((s) => [s.id, s.name]));
  const observed = data.observedStations ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{aq("observedTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{aq("observedSub")}</p>
      </CardHeader>
      <CardContent>
        {observed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{aq("noObserved")}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {observed.map((st) => (
              <li key={st.id} className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border bg-muted/20">
                <div className="h-3 w-3 rotate-45 shrink-0" style={{ background: aqiColor(st.aqi) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{st.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {aq("aqiLabel")}
                    {st.aqi} — {aqiT(aqiCode(st.aqi))} · PM2.5 {st.pm25} µg/m³
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {aq("nearestPoint", { name: pointName.get(st.nearestPointId) ?? "—" })} ·{" "}
                    {aq("observedAt", { time: formatDateTime(st.observedAt) })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AirQualityPage() {
  const { data, isLoading, isError, refetch } = useAQIData();
  const aq = useTranslations("airQualityPage");
  const aqiT = useTranslations("aqi");
  const c = useTranslations("cards");

  const pollutantsData = data
    ? [
        { name: "PM2.5", value: data.pm25 ?? 0, limit: 35 },
        { name: "PM10", value: data.pm10 ?? 0, limit: 150 },
        { name: "O₃", value: data.o3 ?? 0, limit: 100 },
        { name: "NO₂", value: data.no2 ?? 0, limit: 100 },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto">
    <div className="space-y-5 max-w-6xl mx-auto p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{aq("title")}</h1>
          <p className="text-sm text-muted-foreground">{aq("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <DataSourceTag source={aq("source")} />
          {data?.stale && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              {c("stale")}
            </span>
          )}
        </div>
      </div>

      {isLoading && <LoadingSkeleton count={6} variant="card" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          {/* Score card, matching FloodPage/HeatPage's layout (big number + level badge +
              stats) — AQI's own index already IS its risk score (0–500 EPA scale), same as
              flood's R_f (%) and heat's T_eff (°C); each hazard just keeps its native unit
              rather than a made-up shared 0–100 scale. */}
          <Card>
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-5">
              <div className="flex items-center gap-3">
                <Wind className="h-8 w-8" style={{ color: aqiColor(data.aqi ?? 0) }} />
                <div>
                  <p className="text-3xl font-bold" style={{ color: aqiColor(data.aqi ?? 0) }}>
                    {data.aqi ?? "--"}
                  </p>
                  <p className="text-sm text-muted-foreground">{aq("scoreLabel")}</p>
                </div>
              </div>
              <div className="sm:ml-4">
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium border"
                  style={{
                    background: `${aqiColor(data.aqi ?? 0)}20`,
                    color: aqiColor(data.aqi ?? 0),
                    borderColor: `${aqiColor(data.aqi ?? 0)}4d`,
                  }}
                >
                  {aqiT(aqiCode(data.aqi ?? 0))}
                </span>
              </div>
              <div className="sm:ml-auto flex gap-6">
                <div className="text-center">
                  <p className="text-lg font-semibold">{data.pm25?.toFixed(0) ?? "--"}</p>
                  <p className="text-xs text-muted-foreground">PM2.5</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">{data.stations?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{aq("pointCount")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="flex flex-col items-center justify-center py-6">
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-sm font-medium text-muted-foreground">{aq("currentAqi")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                <AQIGauge value={data.aqi ?? 0} size={160} />
                <p className="text-sm text-muted-foreground">
                  {aq("mainPollutant")}
                  <span className="text-foreground font-medium">PM2.5</span>
                </p>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{aq("breakdown")}</CardTitle>
                <p className="text-xs text-muted-foreground">{aq("breakdownSub")}</p>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={pollutantsData}
                  bars={[
                    { dataKey: "value", color: "#f97316", name: aq("measured") },
                    { dataKey: "limit", color: "rgba(255,255,255,0.15)", name: aq("whoLimit") },
                  ]}
                  xDataKey="name"
                  height={200}
                  showLegend
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{aq("stations")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(data.stations ?? []).map((station) => (
                  <div
                    key={station.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20"
                  >
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: aqiColor(station.aqi) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{station.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {aq("aqiLabel")}
                        {station.aqi} — {aqiT(aqiCode(station.aqi))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <ObservedStationsList data={data} />

          <HazardAlerts hazard="aqi" />
          <HazardRecommendations category="air" />
        </>
      )}
    </div>
    </div>
  );
}
