/**
 * Realistic S-002 payloads, typed from the generated contracts (packages/contracts) and
 * copied from a live stack (2026-09-24). `commune` values deliberately reuse former district
 * words ("Phường Bình Thạnh", "Xã Nhà Bè") — the name-guard test proves they never render.
 */
import type { components } from "@ucdt/contracts";

type S = components["schemas"];

const T = "2026-09-24T08:35:07.675Z";
const fresh = { observedAt: T, stale: false, modelVersion: "pdim-s1" };

const square = (lng: number, lat: number): S["FloodGeoJSONFeature"] => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[lng, lat], [lng + 0.01, lat], [lng + 0.01, lat + 0.01], [lng, lat]]] },
  properties: {},
});

export const floodTerms = (p: number, t: number, i: number, d: number): S["FloodTerm"][] => [
  { key: "rainfall", weight: 0.45, normalized: p, contribution: 0.45 * p },
  { key: "terrain", weight: 0.3, normalized: t, contribution: 0.3 * t },
  { key: "imperviousness", weight: 0.25, normalized: i, contribution: 0.25 * i },
  { key: "drainage", weight: 0.15, normalized: d, contribution: -0.15 * d },
];

export const weather: S["WeatherLatest"] = {
  ...fresh,
  current: {
    temperature: 27.3,
    feelsLike: 30.1,
    humidity: 78,
    rainfall: 0.5,
    windSpeed: 9.4,
    windDirection: 200,
    condition: "Mưa nhẹ",
    timestamp: T,
  },
  forecast: [{ hour: "2026-09-24T16:00", temperature: 28, rainfall: 0.2, windSpeed: 9, stormProbability: 5 }],
};

export const flood: S["FloodLatest"] = {
  ...fresh,
  overallRisk: "medium",
  riskScore: 0.274,
  triggers: { currentRainfall: 0.5, terrainSensitivity: 0.62, imperviousness: 0.58, drainageCapacity: 0.31 },
  decomposition: floodTerms(0.01, 0.62, 0.58, 0.31),
  affectedAreas: [
    {
      id: "gz-q8-rach-ong",
      name: "Rạch Ông",
      lat: 10.7285,
      lng: 106.6785,
      riskLevel: "medium",
      riskScore: 0.288,
      estimatedDepth: 0.23,
      rainfall: 0.5,
      decomposition: floodTerms(0.01, 0.625, 0.563678, 0.3),
      geojson: square(106.6785, 10.7285),
    },
    {
      id: "gz-bt-ung-van-khiem",
      name: "Ung Văn Khiêm",
      lat: 10.806,
      lng: 106.713,
      riskLevel: "medium",
      riskScore: 0.33,
      estimatedDepth: 0.26,
      rainfall: 0.4,
      decomposition: floodTerms(0.008, 0.8, 0.7, 0.3),
      geojson: square(106.713, 10.806),
    },
  ],
};

export const heat: S["HeatLatest"] = {
  ...fresh,
  city: "hcmc",
  timestamp: T,
  avgTemperature: 27.3,
  maxTemperature: 35.7,
  heatIslandIntensity: 2.5,
  avgEffectiveTemperature: 33.9,
  baselines: { density: 0.708, greenPct: 21.8 },
  hotspots: [
    { id: "q1", name: "Bến Nghé", lat: 10.7769, lng: 106.7009, temperature: 34.1, intensity: 0.725 },
    { id: "binhthanh", name: "Đinh Bộ Lĩnh", lat: 10.812, lng: 106.712, temperature: 34.8, intensity: 0.84 },
    { id: "cangio", name: "Cần Thạnh", lat: 10.412, lng: 106.952, temperature: 31.2, intensity: 0.12 },
  ],
  geojson: { type: "FeatureCollection", features: [] },
};

export const aqi: S["AQILatest"] = {
  ...fresh,
  aqi: 36,
  category: "Tốt",
  pm25: 8.6,
  pm10: 9.4,
  o3: 42,
  no2: 20.1,
  trend: "decreasing",
  forecast24h: [{ hour: "2026-09-24T15:00", aqi: 36 }],
  stations: [
    { id: "station-q10", name: "Ba Tháng Hai", lat: 10.775, lng: 106.668, aqi: 36 },
    { id: "station-binhthanh", name: "Đinh Bộ Lĩnh", lat: 10.812, lng: 106.712, aqi: 41 },
    { id: "station-nhabe", name: "Phước Kiển", lat: 10.69, lng: 106.72, aqi: 36 },
  ],
  observedStations: [
    {
      id: "ag:82509",
      name: "CMT8",
      lat: 10.78533,
      lng: 106.67029,
      aqi: 37,
      pm25: 8.8,
      observedAt: "2026-09-24T08:34:16.000Z",
      source: "airgradient",
      nearestPointId: "station-q10",
    },
  ],
};

const rec = (
  ruleId: string,
  unitId: string,
  unitName: string,
  unitKind: S["Recommendation"]["unitKind"],
  commune: string | null,
  priorityScore: number,
  inputs: S["RecommendationInputs"],
): S["Recommendation"] => ({
  id: `${ruleId}:${unitId}`,
  ruleId,
  unitId,
  unitName,
  unitKind,
  commune,
  priorityScore,
  priority: priorityScore >= 3 ? "urgent" : "medium",
  category: unitKind === "aqi_point" ? "air" : unitKind === "heat_cell" ? "heat" : "flood",
  title: "Theo dõi tình hình mưa",
  message: `Theo dõi tình hình mưa tại ${unitName} (điểm rủi ro 33%).`,
  actionItems: ["Tránh đỗ xe ở khu vực trũng thấp"],
  timestamp: T,
  inputs,
});

export const recommendations: S["Recommendation"][] = [
  rec("R-FLOOD-03", "gz-bt-ung-van-khiem", "Ung Văn Khiêm", "flood_zone", "Phường Bình Thạnh", 1.46, {
    severityBand: "medium",
    exposureE: 0.90968,
    feasibilityFa: 0.8,
    riskScore: 0.33,
    rainfall: 0.4,
  }),
  rec("R-HEAT-02", "nhabe", "Phước Kiển", "heat_cell", "Xã Nhà Bè", 1.2, {
    severityBand: "moderate",
    exposureE: 0.5,
    feasibilityFa: 0.8,
    effectiveTemperature: 37.4,
  }),
  rec("R-COMB-01", "gz-q8-rach-ong", "Rạch Ông", "flood_zone", "Phường Chánh Hưng", 3.23, {
    severityBand: "high",
    exposureE: 0.85,
    feasibilityFa: 0.95,
    riskScore: 0.52,
    aqi: 160,
    aqiPointId: "station-q8",
  }),
];

export const recommend: S["RecommendLatest"] = {
  ...fresh,
  recommendations,
  allRecommendations: recommendations,
  firedCount: 14,
  summary: "3 khuyến nghị",
  overallRiskLevel: "medium",
};

/** GET /api/units rows (§A.3): the commune is data only. */
export const units: S["UnitRow"][] = [
  { id: "gz-bt-ung-van-khiem", kind: "flood_zone", name: "Ung Văn Khiêm", lat: 10.806, lng: 106.713, commune: "Phường Bình Thạnh", communeOsmId: 1 },
  { id: "gz-q8-rach-ong", kind: "flood_zone", name: "Rạch Ông", lat: 10.7285, lng: 106.6785, commune: "Xã Bình Hưng", communeOsmId: 2 },
  { id: "nhabe", kind: "heat_cell", name: "Phước Kiển", lat: 10.69, lng: 106.72, commune: "Xã Nhà Bè", communeOsmId: 3 },
];

export const alerts: S["AlertsResponse"] = {
  alerts: [
    {
      id: "flood:gz-bt-ung-van-khiem:warning:2026-09-24T15",
      severity: "warning",
      type: "flood",
      title: "Nguy cơ ngập tại Ung Văn Khiêm",
      message: "Điểm rủi ro 52% tại Ung Văn Khiêm.",
      isRead: false,
      createdAt: T,
      expiresAt: "2026-09-24T11:35:07.675Z",
    },
  ],
  unreadCount: 1,
  totalCount: 1,
};

const notYet = (name: string, current: number, required: number, reason: string): S["Stage"] => ({
  eligible: false,
  reason,
  criteria: [{ name, current, required }],
});
const s1: S["Stage"] = { eligible: true, reason: null, criteria: [] };
const s3 = notYet("archiveMonths", 0, 12, "needs ≥ 12 months of archived data");

export const maturity: S["MaturityResponse"] = {
  evaluatedAt: T,
  windowDays: 14,
  deltaAqi: 2,
  hazards: [
    {
      hazard: "flood",
      active: "S1",
      modelVersion: "pdim-s1",
      stages: { S1: s1, S2: notYet("inundationSeries", 0, 1, "w₁…w₄ need an observed inundation / gauge series"), S3: s3 },
      s1MaeHoldout: null,
      s2: null,
    },
    {
      hazard: "heat",
      active: "S1",
      modelVersion: "pdim-s1",
      stages: { S1: s1, S2: notYet("lstSeries", 0, 1, "α and u need observed land-surface temperature"), S3: s3 },
      s1MaeHoldout: null,
      s2: null,
    },
    {
      hazard: "aqi",
      active: "S2",
      modelVersion: "pdim-s2-aqi",
      stages: {
        S1: s1,
        S2: {
          eligible: true,
          reason: null,
          criteria: [
            { name: "consecutiveHourPairs", current: 170, required: 168 },
            { name: "spanDays", current: 7.1, required: 7 },
          ],
        },
        S3: s3,
      },
      s1MaeHoldout: 4.4506,
      s2: {
        estimates: {
          gammaWind: { value: 0.062, estimate: 0.062, se: 0.011, ci95: [0.04, 0.084] },
          gammaRain: { value: 0.131, estimate: 0.131, se: 0.03, ci95: [0.072, 0.19] },
        },
        maeHoldout: 2.1,
        nTrain: 119,
        nHoldout: 51,
        promoted: true,
      },
    },
  ],
};

export const simulation: S["SimulationResult"] = {
  simulationId: "sim-1790239106302-1",
  status: "completed",
  results: {
    floodRiskDelta: 0.12,
    newFloodAreas: flood.affectedAreas,
    tempDelta: -1.5,
    aqiDelta: -6,
    stations: [
      { id: "station-q10", name: "Ba Tháng Hai", before: 36, after: 30, delta: -6 },
      { id: "station-binhthanh", name: "Đinh Bộ Lĩnh", before: 41, after: 33, delta: -8 },
    ],
  },
  comparison: { before: { riskScore: 0.4, affectedAreas: 12 }, after: { riskScore: 0.52, affectedAreas: 18 } },
  counterfactual: {
    recommendations: [recommendations[2], recommendations[0]],
    firedCount: 9,
    alerts: [
      {
        id: "flood:gz-q8-rach-ong:critical:2026-09-24T15",
        type: "flood",
        severity: "critical",
        unitId: "gz-q8-rach-ong",
        unitName: "Rạch Ông",
        value: 0.78,
        title: "Ngập nghiêm trọng tại Rạch Ông",
        message: "Điểm rủi ro 78% tại Rạch Ông.",
        createdAt: T,
        expiresAt: "2026-09-24T10:35:07.675Z",
      },
    ],
    bandChanges: {
      flood: [{ unitId: "gz-q8-rach-ong", name: "Rạch Ông", before: "medium", after: "critical" }],
      heat: [{ unitId: "binhthanh", name: "Đinh Bộ Lĩnh", before: "moderate", after: "low" }],
      aqi: [],
    },
  },
};
