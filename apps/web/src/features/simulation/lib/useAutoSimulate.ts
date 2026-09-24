import { useEffect, useRef, useState } from "react";
import { useSimulation } from "@/shared/hooks/useSimulation";
import { useSimulationStore } from "@/shared/stores/simulationStore";
import { useHeatMap } from "@/shared/hooks/useHeatMap";
import { useCityStore } from "@/shared/stores/cityStore";
import type { SimulationRequest, SimulationResult } from "@/shared/types/simulation";
import { buildScenarioRequest, type ScenarioKind } from "./scenarioRequest";

const DEBOUNCE_MS = 150;

/**
 * Drives a scenario's what-if preview: 150ms after the sliders settle, POST
 * /api/simulation and hand the result back as TanStack mutation state (never zustand —
 * result used to live in simulationStore, against the "no server state in a UI store"
 * rule; see shared/hooks/useSimulation.ts). `runNow` bypasses the debounce for an
 * explicit "Run" button.
 *
 * `data` is the LAST SETTLED result, not the mutation's own `data`: TanStack resets a
 * mutation's `data` to undefined on every new `mutate()`, so passing it straight through
 * made every slider tick unmount the map layers, flash the idle hint and collapse the
 * ComparePanel before the next response landed — the whole screen jumped instead of
 * only the numbers changing. A sequence number drops a slow response that arrives after
 * a newer one.
 */
export function useAutoSimulate(scenario: ScenarioKind) {
  const params = useSimulationStore((s) => s.params);
  const cityId = useCityStore((s) => s.selectedCity.id);
  // ΔG is measured against the served G₀ (heat baselines, §C) — every scenario's green lever.
  const baselines = useHeatMap().data?.baselines;
  const simulation = useSimulation();
  const { mutate } = simulation;
  const [settled, setSettled] = useState<SimulationResult | undefined>(undefined);
  const seq = useRef(0);

  const request = buildScenarioRequest(scenario, cityId, params, baselines);
  const requestKey = JSON.stringify(request);

  const run = (body: SimulationRequest) => {
    const id = ++seq.current;
    mutate(body, {
      onSuccess: (result) => {
        if (id === seq.current) setSettled(result);
      },
    });
  };

  useEffect(() => {
    const t = setTimeout(() => run(request), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestKey is request's content
  }, [requestKey, mutate]);

  const runNow = () => run(request);
  const reset = () => {
    seq.current++; // an in-flight response must not resurrect the result we just cleared
    setSettled(undefined);
    simulation.reset();
  };

  return { ...simulation, data: settled, runNow, reset };
}
