import { describe, it, expect } from "vitest";
import { buildHeatGeojson } from "./heatGeojson";
import type { HeatHotspot } from "@/shared/types/heat";

const HOTSPOTS: HeatHotspot[] = [
  { id: "z1", name: "Zone 1", lat: 10.8, lng: 106.7, temperature: 35, intensity: 0.6 },
];

describe("buildHeatGeojson (B-006)", () => {
  it("temp equals hotspot temperature plus exactly the backend delta", () => {
    const geojson = buildHeatGeojson(HOTSPOTS, 2.5);
    expect(geojson.features[0].properties!.temp).toBe(37.5);
  });

  it("never blends a local drift when no backend result exists yet (delta = 0)", () => {
    const geojson = buildHeatGeojson(HOTSPOTS, null);
    expect(geojson.features[0].properties!.temp).toBe(35);
  });

  it("treats undefined the same as null (no result yet)", () => {
    const geojson = buildHeatGeojson(HOTSPOTS, undefined);
    expect(geojson.features[0].properties!.temp).toBe(35);
  });
});
