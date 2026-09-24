import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { SimulationRequest, SimulationResult } from "@/shared/types/simulation";
import { useSimulationStore } from "@/shared/stores/simulationStore";

// Each POST resolves only when the test says so, in any order.
const pending: Array<{ body: SimulationRequest; resolve: (r: SimulationResult) => void }> = [];
vi.mock("@/shared/services", () => ({
  runSimulation: (body: SimulationRequest) =>
    new Promise<SimulationResult>((resolve) => pending.push({ body, resolve })),
}));

const { useAutoSimulate } = await import("./useAutoSimulate");

const resultWith = (tempDelta: number) =>
  ({
    simulationId: `sim-${tempDelta}`,
    status: "completed",
    results: { floodRiskDelta: 0, newFloodAreas: [], tempDelta, aqiDelta: 0, affectedBuildings: 0, affectedPopulation: 0 },
    comparison: { before: { riskScore: 0, affectedAreas: 0 }, after: { riskScore: 0, affectedAreas: 0 } },
  }) as SimulationResult;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

async function settle(i: number, r: SimulationResult) {
  await act(async () => {
    pending[i].resolve(r);
  });
}

describe("useAutoSimulate", () => {
  beforeEach(() => {
    pending.length = 0;
    useSimulationStore.getState().resetSimulation();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the last settled result while the next request is in flight (no screen-wide flash)", async () => {
    const { result } = renderHook(() => useAutoSimulate("heat"), { wrapper });
    await act(async () => vi.advanceTimersByTime(200));
    await settle(0, resultWith(-1));
    expect(result.current.data?.results.tempDelta).toBe(-1);

    // Slider tick -> a new request goes out. The old result must stay on screen meanwhile.
    act(() => useSimulationStore.getState().setParams({ greenCoverage: 0.5 }));
    await act(async () => vi.advanceTimersByTime(200));
    expect(pending).toHaveLength(2);
    expect(result.current.data?.results.tempDelta).toBe(-1);

    await settle(1, resultWith(-3));
    expect(result.current.data?.results.tempDelta).toBe(-3);
  });

  it("drops a slow response that lands after a newer one", async () => {
    const { result } = renderHook(() => useAutoSimulate("heat"), { wrapper });
    await act(async () => vi.advanceTimersByTime(200));
    act(() => useSimulationStore.getState().setParams({ greenCoverage: 0.6 }));
    await act(async () => vi.advanceTimersByTime(200));
    expect(pending).toHaveLength(2);

    await settle(1, resultWith(-4)); // newer first
    await settle(0, resultWith(-1)); // stale one arrives late
    expect(result.current.data?.results.tempDelta).toBe(-4);
  });

  it("reset clears the result and ignores the in-flight response", async () => {
    const { result } = renderHook(() => useAutoSimulate("heat"), { wrapper });
    await act(async () => vi.advanceTimersByTime(200));
    act(() => result.current.reset());
    await settle(0, resultWith(-2));
    expect(result.current.data).toBeUndefined();
  });
});
