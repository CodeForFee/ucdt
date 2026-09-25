import { useTranslations } from "use-intl";

/**
 * T_eff = HI(T, RH) + 3.5°C·ρ (spec §C) — both terms come from HeatLatest fields the server
 * already serves (avgEffectiveTemperature, heatIslandIntensity = mean UHI contribution);
 * heatIndex = avgEffectiveTemperature - heatIslandIntensity is exact subtraction of two served
 * numbers, not a model recomputed client-side (DP3) — unlike flood/AQI, heat has no separate
 * `decomposition` field from climate, so this is the smallest way to show both terms without
 * a backend change, ported to a new field if/when heat.py starts serving one directly.
 */
export function HeatDecomposition({
  avgEffectiveTemperature,
  heatIslandIntensity,
}: {
  avgEffectiveTemperature: number;
  heatIslandIntensity: number;
}) {
  const hp = useTranslations("heatPage");
  const heatIndex = avgEffectiveTemperature - heatIslandIntensity;
  const terms = [
    { key: "heatIndex", value: heatIndex, label: hp("trigHeatIndex"), note: hp("heatIndexNote") },
    { key: "uhi", value: heatIslandIntensity, label: hp("trigUhi"), note: hp("uhiNote") },
  ] as const;
  const scale = Math.max(...terms.map((t) => t.value), 0.01);

  return (
    <div className="space-y-4">
      {terms.map((t) => (
        <div key={t.key} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{t.label}</span>
            <span className="font-mono text-xs">+{t.value.toFixed(1)}°C</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-orange-500/70" style={{ width: `${(t.value / scale) * 100}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">{t.note}</p>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm">
        <span className="font-medium">{hp("sumLabel")}</span>
        <span className="font-mono">{avgEffectiveTemperature.toFixed(1)}°C</span>
      </div>
    </div>
  );
}
