// Matches BE FloodResponse exactly
export interface FloodData {
  overallRisk: string;
  riskScore: number;
  affectedAreas: FloodArea[];
  triggers: FloodTriggers;
}

export interface FloodArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  estimatedDepth: number;
  geojson: FloodGeoJSONFeature;
}

export interface FloodTriggers {
  currentRainfall: number;
  soilSaturation: number;
  drainageCapacity: number;
  /** City-aggregate terrain sensitivity T̃ — the second-largest term of R_f. */
  terrainSensitivity: number;
}

export interface FloodGeoJSONFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: Record<string, unknown>;
}
