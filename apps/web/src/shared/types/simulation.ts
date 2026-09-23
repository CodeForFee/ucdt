export interface SimulationRequest {
  cityId: string;
  scenario: {
    rainfallIncrease: number;
    rainfallDurationHours: number;
    addGreenCoverage: number;
    trafficReduction: number;
    // Optional: omitted scenarios are scored against the baseline density, so the UHI
    // term contributes nothing to the returned tempDelta.
    urbanDensity?: number;
  };
}

export interface SimulationParams {
  preset: string;
  rainfallMultiplier: number;
  trafficReduction: number;
  greenCoverage: number;
  urbanDensity?: number;
  enable3D: boolean;
  showBuildings: boolean;
  city: string;
}

// Actual BE response shape
export interface SimulationResult {
  simulationId: string;
  status: string;
  results: {
    floodRiskDelta: number;
    newFloodAreas: SimFloodArea[];
    tempDelta: number;
    aqiDelta: number;
    affectedBuildings: number;
    affectedPopulation: number;
  };
  comparison: {
    before: { riskScore: number; affectedAreas: number };
    after: { riskScore: number; affectedAreas: number };
  };
  // combined geojson used by FloodExtrusion3D
  geojson?: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      geometry: { type: string; coordinates: number[][][] };
      properties: {
        name: string;
        riskLevel: "low" | "medium" | "high" | "critical";
        riskScore: number;
        estimatedDepth: number;
        simulated?: boolean;
      };
    }>;
  };
}

export interface SimFloodArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  estimatedDepth: number;
  geojson: {
    type: "Feature";
    geometry: { type: string; coordinates: number[][][] };
    properties: Record<string, unknown>;
  };
}

export interface SimulationMetrics {
  riskScore: number;
  affectedAreas: number;
  tempAvg: number;
  aqiAvg: number;
  affectedBuildings: number;
  affectedPopulation: number;
}
