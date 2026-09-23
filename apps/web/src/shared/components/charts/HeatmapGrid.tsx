import { useTranslations } from "use-intl";

import { AQI_COLORS } from "@/shared/lib/colorScales";

interface HeatmapCell {
  hour: number;
  day: string;
  value: number;
}

interface HeatmapGridProps {
  data: HeatmapCell[];
  minValue?: number;
  maxValue?: number;
  valueLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function interpolateColor(value: number, min: number, max: number): string {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (ratio < 0.25) return AQI_COLORS.good;
  if (ratio < 0.5) return AQI_COLORS.moderate;
  if (ratio < 0.75) return AQI_COLORS.unhealthySensitive;
  return AQI_COLORS.unhealthy;
}

export function HeatmapGrid({
  data,
  minValue = 0,
  maxValue = 200,
  valueLabel = "AQI",
}: HeatmapGridProps) {
  const t = useTranslations("chart");
  // Day initials and the legend ends come from i18n; they used to be a hardcoded
  // Vietnamese array that rendered in the English build too.
  const DAYS = t.raw("days") as string[];
  const cellMap = new Map<string, number>();
  data.forEach((cell) => {
    cellMap.set(`${cell.day}-${cell.hour}`, cell.value);
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex items-center gap-1 mb-2">
          <div className="w-6" />
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground" style={{ minWidth: 20 }}>
              {h}h
            </div>
          ))}
        </div>
        {DAYS.map((day) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="w-6 text-[10px] text-muted-foreground text-right pr-1">{day}</div>
            {HOURS.map((hour) => {
              const value = cellMap.get(`${day}-${hour}`);
              const bg =
                value !== undefined
                  ? interpolateColor(value, minValue, maxValue)
                  : "rgba(255,255,255,0.05)";
              return (
                <div
                  key={hour}
                  title={value !== undefined ? `${day} ${hour}h: ${valueLabel} ${value}` : undefined}
                  className="flex-1 rounded-sm cursor-default"
                  style={{ height: 16, background: bg, minWidth: 10, opacity: value !== undefined ? 0.85 : 0.3 }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground">{t("low")}</span>
          <div className="flex gap-0.5">
            {[AQI_COLORS.good, AQI_COLORS.moderate, AQI_COLORS.unhealthySensitive, AQI_COLORS.unhealthy].map((c) => (
              <div key={c} className="w-6 h-2.5 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">{t("high")}</span>
        </div>
      </div>
    </div>
  );
}
