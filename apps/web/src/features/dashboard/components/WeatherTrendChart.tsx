import { useTranslations } from "use-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWeatherData } from "@/shared/hooks/useWeatherData";
import { AreaChart } from "@/shared/components/charts/AreaChart";
import { BarChart } from "@/shared/components/charts/BarChart";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";

export function WeatherTrendChart() {
  const { data, isLoading, isError, refetch } = useWeatherData();
  const ch = useTranslations("chart");

  if (isLoading) return <LoadingSkeleton count={1} variant="chart" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const forecast = data?.forecast ?? [];
  const tempKey = ch("temperature");
  const rainKey = ch("rainfall");

  const tempData = forecast.map((f) => ({ name: f.hour, [tempKey]: f.temperature }));
  const rainData = forecast.map((f) => ({ name: f.hour, [rainKey]: f.rainfall }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{ch("temp24h")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AreaChart
            data={tempData}
            areas={[{ dataKey: tempKey, color: "#f97316", fillOpacity: 0.15 }]}
            xDataKey="name"
            height={160}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{ch("rain24h")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={rainData}
            bars={[{ dataKey: rainKey, color: "#3b82f6", radius: 2 }]}
            xDataKey="name"
            height={160}
          />
        </CardContent>
      </Card>
    </div>
  );
}
