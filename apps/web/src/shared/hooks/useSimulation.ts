import { useMutation } from "@tanstack/react-query";
import { runSimulation } from "@/shared/services";
import type { SimulationRequest, SimulationResult } from "@/shared/types/simulation";

/**
 * Plain mutation — no store side effects. `result`/`isRunning` used to live in
 * simulationStore (server state in a UI-only store, against the KLTN rule); the caller
 * now reads `data`/`isPending` straight off this hook instead.
 */
export function useSimulation() {
  return useMutation<SimulationResult, Error, SimulationRequest>({
    mutationFn: (body) => runSimulation(body),
  });
}
