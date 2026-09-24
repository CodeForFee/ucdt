import { useState } from "react";
import { useTranslations } from "use-intl";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFloodRisk } from "@/shared/hooks/useFloodRisk";
import { useAQIData } from "@/shared/hooks/useAQIData";

export function RiskSummaryBanner() {
  const { data: flood } = useFloodRisk();
  const { data: aqi } = useAQIData();
  const [dismissed, setDismissed] = useState(false);
  const b = useTranslations("banner");

  const showFlood = (flood?.riskScore ?? 0) > 0.75;
  const showAQI = (aqi?.aqi ?? 0) > 150;

  if (dismissed || (!showFlood && !showAQI)) return null;

  const isCritical = (flood?.riskScore ?? 0) > 0.9 || (aqi?.aqi ?? 0) > 200;

  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-4 py-3 border ${
        isCritical
          ? "bg-red-500/10 border-red-500/40 text-red-300"
          : "bg-yellow-500/10 border-yellow-500/40 text-yellow-300"
      }`}
    >
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{isCritical ? b("criticalAlert") : b("warning")}</p>
        <ul className="mt-1 space-y-0.5 text-sm opacity-90">
          {showFlood && (
            <li>
              {b("floodRisk")}
              {flood?.overallRisk === "critical" ? b("critical") : b("high")}
              {b("riskScore")}
              {((flood?.riskScore ?? 0) * 100).toFixed(0)}/100
            </li>
          )}
          {showAQI && (
            <li>
              {b("aqiPoor")}
              {aqi?.aqi}
              {b("mainPollutant")}
            </li>
          )}
        </ul>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
        onClick={() => setDismissed(true)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
