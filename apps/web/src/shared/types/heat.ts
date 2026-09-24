export interface HeatData {
  city: string;
  timestamp: string;
  avgTemperature: number;
  maxTemperature: number;
  heatIslandIntensity: number;
  /** Mean effective temperature T_eff over the heat cells — the heat what-if baseline (B-020).
   *  Absent on snapshots written before the field existed. */
  avgEffectiveTemperature?: number | null;
  hotspots: HeatHotspot[];
  geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      geometry: { type: string; coordinates: number[] };
      properties: { temperature: number; intensity: number };
    }>;
  };
}

export interface HeatHotspot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  temperature: number;
  intensity: number;
}
