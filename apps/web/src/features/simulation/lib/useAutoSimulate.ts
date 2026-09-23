import { useEffect } from "react";
import { useSimulation } from "@/shared/hooks/useSimulation";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useCityStore } from "@/shared/stores/cityStore";
import { buildScenarioRequest, type ScenarioKind } from "./scenarioRequest";

const DEBOUNCE_MS = 150;

/**
 * Drives a scenario's what-if preview: 150ms after the sliders settle, POST
 * /api/simulation and hand the result back as TanStack mutation state (never zustand —
 * result used to live in simulationStore, against the "no server state in a UI store"
 * rule; see shared/hooks/useSimulation.ts). `runNow` bypasses the debounce for an
 * explicit "Run" button.
 */
export function useAutoSimulate(scenario: ScenarioKind) {
  const params = useSimulationStore((s) => s.params);
  const cityId = useCityStore((s) => s.selectedCity.id);
  const simulation = useSimulation();
  const { mutate } = simulation;

  const request = buildScenarioRequest(scenario, cityId, params);
  const requestKey = JSON.stringify(request);

  useEffect(() => {
    const id = setTimeout(() => mutate(request), DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey is request's content
  }, [requestKey, mutate]);

  const runNow = () => mutate(request);

  return { ...simulation, runNow };
}
