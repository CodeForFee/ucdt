import { create } from "zustand";
import type { SimulationParams } from "@/shared/types/simulation";

export type ScenarioTab = "flood" | "heat" | "aqi";

// UI-only (KLTN rule: no server state in zustand). `result`/`isRunning` used to live
// here; the mutation that produces a result now owns that state itself — see
// shared/hooks/useSimulation.ts — and the caller reads it from the mutation, not the
// store.
interface SimulationState {
  params: SimulationParams;
  showComparison: boolean;
  activeScenario: ScenarioTab;
  focusPoint: { lat: number; lng: number; zoom?: number; popupHtml?: string } | null;
  setParams: (params: Partial<SimulationParams>) => void;
  setShowComparison: (show: boolean) => void;
  setActiveScenario: (s: ScenarioTab) => void;
  setFocusPoint: (
    p: { lat: number; lng: number; zoom?: number; popupHtml?: string } | null,
  ) => void;
  resetSimulation: () => void;
}

const DEFAULT_PARAMS: SimulationParams = {
  preset: "baseline",
  rainfallMultiplier: 1.0,
  trafficReduction: 0,
  // greenCoverage / urbanDensity stay unset: the sliders sit at the SERVED G₀ / ρ₀ (§C)
  // until moved, never at a hard-coded 30 % / 0.8.
  enable3D: true,
  showBuildings: true,
  city: "hcmc",
};

export const useSimulationStore = create<SimulationState>((set) => ({
  params: DEFAULT_PARAMS,
  showComparison: false,
  activeScenario: "flood",
  focusPoint: null,
  setParams: (params) => set((s) => ({ params: { ...s.params, ...params } })),
  setShowComparison: (showComparison) => set({ showComparison }),
  setActiveScenario: (activeScenario) => set({ activeScenario }),
  setFocusPoint: (focusPoint) => set({ focusPoint }),
  resetSimulation: () => set({ params: DEFAULT_PARAMS, showComparison: false }),
}));
