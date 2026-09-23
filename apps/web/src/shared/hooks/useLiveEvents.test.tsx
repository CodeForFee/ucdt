import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLiveEvents } from "./useLiveEvents";
import { MockEventSource } from "@/test/setup";

function Probe() {
  useLiveEvents();
  return null;
}

function renderProbe() {
  const queryClient = new QueryClient();
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

describe("useLiveEvents", () => {
  beforeEach(() => {
    MockEventSource.instances.length = 0;
  });

  it("invalidates the hazard's query keys on snapshot.updated", () => {
    const { invalidateSpy } = renderProbe();
    const source = MockEventSource.instances.at(-1)!;

    source.emit("snapshot.updated", { hazard: "flood" });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["flood"] });
  });

  it("invalidates alerts on alert.created", () => {
    const { invalidateSpy } = renderProbe();
    const source = MockEventSource.instances.at(-1)!;

    source.emit("alert.created", {});

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["alerts"] });
  });

  it("ignores an unknown hazard rather than invalidating the wrong cache", () => {
    const { invalidateSpy } = renderProbe();
    const source = MockEventSource.instances.at(-1)!;

    source.emit("snapshot.updated", { hazard: "not-a-real-hazard" });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("closes the connection on unmount", () => {
    const queryClient = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
    const source = MockEventSource.instances.at(-1)!;
    const closeSpy = vi.spyOn(source, "close");

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
