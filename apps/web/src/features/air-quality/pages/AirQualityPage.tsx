import { useTranslations } from "use-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { AQIGauge } from "@/shared/components/charts/AQIGauge";
import { BarChart } from "@/shared/components/charts/BarChart";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { DataSourceTag } from "@/shared/components/common/DataSourceTag";
import { aqiCode, aqiColor } from "@/shared/lib/aqi";
import { formatDateTime } from "@/shared/lib/formatters";
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
    <div className="space-y-5 max-w-6xl mx-auto">
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
        </>
      )}
    </div>
  );
}
