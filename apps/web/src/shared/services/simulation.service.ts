import { apiClient, unwrap } from "@/shared/lib/axios";
import type { SimulationRequest, SimulationResult } from "@/shared/types/simulation";

export const runSimulation = (body: SimulationRequest): Promise<SimulationResult> =>
  apiClient.post("/api/simulation/run", body).then(unwrap<SimulationResult>);
