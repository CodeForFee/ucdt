import { describe, it, expect, afterEach, vi } from "vitest";

// vitest.config.ts's test.env supplies VITE_MAPBOX_TOKEN for every other test file that
// transitively imports @/config/env (axios.ts, mapConfig.ts, ...) — this file is the
// one place that deliberately unsets it to prove the validation actually fires.
describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when VITE_MAPBOX_TOKEN is missing", async () => {
    vi.stubEnv("VITE_MAPBOX_TOKEN", "");
    await expect(import("./env")).rejects.toThrow(/VITE_MAPBOX_TOKEN/);
  });

  it("accepts an empty VITE_API_BASE_URL (same-origin default)", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.stubEnv("VITE_MAPBOX_TOKEN", "pk.ok");
    const { env } = await import("./env");
    expect(env.VITE_API_BASE_URL).toBe("");
    expect(env.VITE_MAPBOX_TOKEN).toBe("pk.ok");
  });
});
