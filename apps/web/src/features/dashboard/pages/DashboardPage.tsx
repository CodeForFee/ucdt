import { useTranslations } from "use-intl";
import { RiskSummaryBanner } from "@/features/dashboard/components/RiskSummaryBanner";
import { OverviewCards } from "@/features/dashboard/components/OverviewCards";
import { WeatherTrendChart } from "@/features/dashboard/components/WeatherTrendChart";
import { RecommendPanel } from "@/features/dashboard/components/RecommendPanel";
import { AQISummaryCard } from "@/features/dashboard/components/AQISummaryCard";
import { HeatSummaryCard } from "@/features/dashboard/components/HeatSummaryCard";
import { FloodSummaryCard } from "@/features/dashboard/components/FloodSummaryCard";
import { AlertsSummaryCard } from "@/features/dashboard/components/AlertsSummaryCard";

export default function DashboardPage() {
  const d = useTranslations("dashboard");

  return (
    <div className="h-full overflow-y-auto">
      {/* max-w matches Header's (see shared/components/layout/Header.tsx) so the nav bar
          and content line up on wide screens. */}
      <div className="space-y-5 max-w-[1600px] mx-auto p-4 lg:p-6">
        <div>
          <h1 className="text-xl font-semibold">{d("title")}</h1>
          <p className="text-sm text-muted-foreground">{d("subtitle")}</p>
        </div>

        <RiskSummaryBanner />
        <OverviewCards />
        <WeatherTrendChart />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AQISummaryCard />
          <HeatSummaryCard />
          <FloodSummaryCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AlertsSummaryCard />
          <RecommendPanel />
        </div>
      </div>
    </div>
  );
}
