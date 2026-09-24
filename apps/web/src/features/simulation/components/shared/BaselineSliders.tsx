import { useTranslations } from "use-intl";
import { RainfallSlider } from "../RainfallSlider";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useHeatMap } from "@/shared/hooks/useHeatMap";

/**
 * The green-cover and density sliders START at the served baselines G₀ / ρ₀ (spec §C, §J):
 * an untouched slider shows the payload's value and sends ΔG = 0 / no urbanDensity. Both
 * inputs are derived from ESA WorldCover, which the description names (DP3).
 */
export function GreenCoverageSlider({ description }: { description: string }) {
  const sl = useTranslations("simulation.sliders");
  const { params, setParams } = useSimulationStore();
  const baselines = useHeatMap().data?.baselines;

  if (!baselines) return <p className="text-xs text-muted-foreground">{sl("waitingBaseline")}</p>;

  const value = params.greenCoverage != null ? Math.round(params.greenCoverage * 1000) / 10 : baselines.greenPct;
  return (
    <RainfallSlider
      label={sl("greenCoverage")}
      value={value}
      min={0}
      max={80}
      step={1}
      unit="%"
      onChange={(v) => setParams({ greenCoverage: v / 100 })}
      description={`${sl("greenBaseline", { g0: baselines.greenPct })} · ${description}`}
    />
  );
}

export function UrbanDensitySlider() {
  const sl = useTranslations("simulation.sliders");
  const { params, setParams } = useSimulationStore();
  const baselines = useHeatMap().data?.baselines;

  if (!baselines) return <p className="text-xs text-muted-foreground">{sl("waitingBaseline")}</p>;

  const density = params.urbanDensity ?? baselines.density;
  return (
    <RainfallSlider
      label={sl("urbanDensity")}
      value={Math.round(density * 1000) / 10}
      min={0}
      max={100}
      step={1}
      unit="%"
      onChange={(v) => setParams({ urbanDensity: v / 100 })}
      description={`${sl("densityBaseline", { rho0: baselines.density })} · ${sl("urbanDensityDesc")}`}
    />
  );
}
