import { useTranslations } from "use-intl";
import { HeatMap } from "@/features/simulation/components/heat/HeatMap";
import { HeatSidebar } from "@/features/simulation/components/heat/HeatSidebar";
import { useAutoSimulate } from "@/features/simulation/lib/useAutoSimulate";
import { useSimulationStore } from "@/shared/stores/simulationStore";

export default function HeatSimulationPage() {
  const ts = useTranslations("simulation");
  const { data: result, reset } = useAutoSimulate("heat");
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <h1 className="sr-only">{ts("titleHeat")}</h1>
      <HeatMap result={result} />
      <HeatSidebar
        result={result}
        onReset={() => {
          resetSimulation();
          reset();
        }}
      />
    </div>
  );
}
