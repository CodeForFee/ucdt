import { useTranslations } from "use-intl";
import { AQIMap } from "@/features/simulation/components/aqi/AQIMap";
import { AQISidebar } from "@/features/simulation/components/aqi/AQISidebar";
import { useAutoSimulate } from "@/features/simulation/lib/useAutoSimulate";
import { useSimulationStore } from "@/shared/stores/simulationStore";

export default function AQISimulationPage() {
  const ts = useTranslations("simulation");
  const { data: result, reset } = useAutoSimulate("aqi");
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <h1 className="sr-only">{ts("titleAqi")}</h1>
      <AQIMap result={result} />
      <AQISidebar
        result={result}
        onReset={() => {
          resetSimulation();
          reset();
        }}
      />
    </div>
  );
}
