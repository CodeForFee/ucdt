import { useTranslations } from "use-intl";
import { FloodMap } from "@/features/simulation/components/flood/FloodMap";
import { FloodSidebar } from "@/features/simulation/components/flood/FloodSidebar";
import { useAutoSimulate } from "@/features/simulation/lib/useAutoSimulate";
import { useSimulationStore } from "@/shared/stores/simulationStore";

export default function FloodSimulationPage() {
  const ts = useTranslations("simulation");
  const { data: result, reset } = useAutoSimulate("flood");
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <h1 className="sr-only">{ts("titleFlood")}</h1>
      <FloodMap result={result} />
      <FloodSidebar
        result={result}
        onReset={() => {
          resetSimulation();
          reset();
        }}
      />
    </div>
  );
}
