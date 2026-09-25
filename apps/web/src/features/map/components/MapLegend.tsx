import { useMapStore } from "@/shared/stores/mapStore";
import { FLOOD_COLORS, AQI_COLORS } from "@/shared/lib/colorScales";
import { useTranslations } from "use-intl";

export function MapLegend() {
  const { activeLayers } = useMapStore();
  const showFlood = activeLayers.includes("flood");
  const showAQI = activeLayers.includes("aqi");
  const showTraffic = activeLayers.includes("traffic");
  const lg = useTranslations("map.legend");

  if (!showFlood && !showAQI && !showTraffic) return null;

  const floodItems = [
    { color: FLOOD_COLORS.low, label: lg("low") },
    { color: FLOOD_COLORS.medium, label: lg("medium") },
    { color: FLOOD_COLORS.high, label: lg("high") },
    { color: FLOOD_COLORS.critical, label: lg("critical") },
  ];

  const aqiItems = [
    { color: AQI_COLORS.good, label: lg("aqiGood") },
    { color: AQI_COLORS.moderate, label: lg("aqiModerate") },
    { color: AQI_COLORS.unhealthySensitive, label: lg("aqiSensitive") },
    { color: AQI_COLORS.unhealthy, label: lg("aqiUnhealthy") },
    { color: AQI_COLORS.veryUnhealthy, label: lg("aqiVeryUnhealthy") },
  ];

  const trafficItems = [
    { color: "#22c55e", label: lg("trafficClear") },
    { color: "#eab308", label: lg("trafficModerate") },
    { color: "#f97316", label: lg("trafficCongested") },
    { color: "#ef4444", label: lg("trafficHeavy") },
  ];

  return (
    <div className="absolute bottom-8 right-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg p-3 space-y-3 min-w-[160px]">
      {showFlood && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{lg("flood")}</p>
          <div className="space-y-1">
            {floodItems.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="h-3 w-4 rounded-sm shrink-0" style={{ background: color, opacity: 0.85 }} />
                <span className="text-xs text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {showAQI && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{lg("aqi")}</p>
          <div className="space-y-1">
            {aqiItems.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs text-foreground">{label}</span>
              </div>
            ))}
            {/* Same marker as AQILayer's OBS_LAYER_ID: measured stations, not CAMS points. */}
            <div className="flex items-center gap-2 pt-1">
              <div className="h-3 w-3 rounded-full shrink-0 border-[3px] border-slate-900 bg-muted" />
              <span className="text-xs text-foreground">{lg("observed")}</span>
            </div>
          </div>
        </div>
      )}
      {showTraffic && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{lg("traffic")}</p>
          <div className="space-y-1">
            {trafficItems.map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="h-0.5 w-4 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
