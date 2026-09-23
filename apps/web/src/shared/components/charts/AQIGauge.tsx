import { aqiCode } from "@/shared/lib/aqi";
import { useTranslations } from "use-intl";

interface AQIGaugeProps {
  value: number;
  size?: number;
}

function getAQIColor(aqi: number): string {
  if (aqi <= 50) return "var(--aqi-good)";
  if (aqi <= 100) return "var(--aqi-moderate)";
  if (aqi <= 150) return "var(--aqi-unhealthy-sensitive)";
  if (aqi <= 200) return "var(--aqi-unhealthy)";
  return "var(--aqi-very-unhealthy)";
}

export function AQIGauge({ value, size = 120 }: AQIGaugeProps) {
  const tAqi = useTranslations("aqi");
  const radius = (size - 16) / 2;
  const circumference = Math.PI * radius;
  const maxAQI = 300;
  const ratio = Math.min(value / maxAQI, 1);
  const strokeDashoffset = circumference * (1 - ratio);
  const color = getAQIColor(value);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
        <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
          <path
            d={`M 8,${size / 2} A ${radius},${radius} 0 0,1 ${size - 8},${size / 2}`}
            fill="none"
            stroke="currentColor"
            className="text-border dark:text-white/10"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={`M 8,${size / 2} A ${radius},${radius} 0 0,1 ${size - 8},${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-2xl font-bold" style={{ color }}>
            {value}
          </span>
          <span className="text-[10px] text-muted-foreground">AQI</span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color }}>
        {tAqi(aqiCode(value))}
      </span>
    </div>
  );
}
