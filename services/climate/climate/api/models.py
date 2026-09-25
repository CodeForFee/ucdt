"""Response/request models. Field names are the legacy Hackathon-BE `data` shapes (camelCase), so the
OpenAPI schema — and the TS types generated from it into packages/contracts — describe the real wire.

Response models allow extra keys: a snapshot `result` is served exactly as stored, and a field the
worker adds must not be silently dropped by FastAPI's response filtering.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic_core import PydanticCustomError

from climate.pdim.simulation import validate_scenario

RiskLevel = Literal["low", "medium", "high", "critical"]


class Out(BaseModel):
    model_config = ConfigDict(extra="allow")


class Latest(Out):
    observedAt: str = Field(description="computed_at of the snapshot, ISO 8601 UTC")
    stale: bool = Field(description="true when the snapshot is older than STALE_AFTER_MINUTES")
    modelVersion: str = Field(
        description="model of the snapshot: pdim-s1, or pdim-s2-aqi for aqi while S2 is active (§H)"
    )


# ── weather ─────────────────────────────────────────────────────────────────────
class WeatherCurrent(Out):
    temperature: float
    feelsLike: float
    humidity: float
    rainfall: float
    windSpeed: float
    windDirection: float
    condition: str
    timestamp: str


class WeatherForecastItem(Out):
    hour: str
    temperature: float
    rainfall: float
    windSpeed: float
    stormProbability: float


class WeatherData(Out):
    current: WeatherCurrent
    forecast: list[WeatherForecastItem]


# ── aqi ─────────────────────────────────────────────────────────────────────────
class AQIForecastItem(Out):
    hour: str
    aqi: float


class AQIStation(Out):
    id: str
    name: str
    lat: float
    lng: float
    aqi: float


class ObservedStation(Out):
    """Open monitoring network station (§I.3), served apart from the CAMS points; feeds §H."""

    id: str = Field(description="ag:<locationId>")
    name: str
    lat: float
    lng: float
    aqi: float = Field(description="US AQI from the station's PM2.5")
    pm25: float = Field(description="µg/m³")
    observedAt: str
    source: str
    nearestPointId: str = Field(description="nearest AQI point (§A.4)")


class AQIData(Out):
    aqi: float
    category: str
    pm25: float
    pm10: float
    o3: float
    no2: float
    trend: Literal["increasing", "decreasing", "stable"]
    forecast24h: list[AQIForecastItem] = Field(description="uses the fitted γ while S2 is active (§H)")
    stations: list[AQIStation]
    observedStations: list[ObservedStation]


# ── flood ───────────────────────────────────────────────────────────────────────
class PolygonGeometry(Out):
    type: str
    coordinates: list[list[list[float]]]


class FloodGeoJSONFeature(Out):
    type: Literal["Feature"]
    geometry: PolygonGeometry
    properties: dict[str, Any]


class FloodTerm(Out):
    """One R_f term ready to render (§B, B-014): the web holds no PDIM weight."""

    key: Literal["rainfall", "terrain", "imperviousness", "drainage"]
    weight: float = Field(description="w_i > 0")
    normalized: float = Field(description="x̃_i in [0, 1]")
    contribution: float = Field(description="w_i·x̃_i; negative for drainage")


class FloodArea(Out):
    id: str
    name: str
    lat: float
    lng: float
    riskLevel: RiskLevel
    riskScore: float
    estimatedDepth: float
    rainfall: float = Field(description="P(i), mm/h at the zone's own coordinate")
    decomposition: list[FloodTerm] = Field(description="Σ contribution = R_f(i) before the clamp")
    geojson: FloodGeoJSONFeature


class FloodTriggers(Out):
    currentRainfall: float = Field(description="city-centre P, mm/h")
    terrainSensitivity: float = Field(description="mean T̃ over the 18 zones")
    imperviousness: float = Field(description="mean Ĩ over the 18 zones")
    drainageCapacity: float = Field(description="mean D̃ over the 18 zones")


class FloodData(Out):
    overallRisk: str
    riskScore: float
    affectedAreas: list[FloodArea]
    triggers: FloodTriggers
    decomposition: list[FloodTerm] = Field(description="city level; Σ contribution = R_f before the clamp")


# ── heat (legacy heatController's transformed shape, not heat.service's raw one) ──
class HeatHotspot(Out):
    id: str
    name: str
    lat: float
    lng: float
    temperature: float
    intensity: float


class PointGeometry(Out):
    type: str
    coordinates: list[float]


class HeatFeatureProps(Out):
    temperature: float
    intensity: float


class HeatFeature(Out):
    type: Literal["Feature"]
    geometry: PointGeometry
    properties: HeatFeatureProps


class HeatGeoJSON(Out):
    type: Literal["FeatureCollection"]
    features: list[HeatFeature]


class HeatBaselines(Out):
    """What-if reference state (§C); the heat sliders start here."""

    density: float = Field(description="ρ₀ = mean builtUp over the 22 cells, 0–1")
    greenPct: float = Field(description="G₀ = mean green cover over the 22 cells, %")


class HeatData(Out):
    city: str
    timestamp: str
    avgTemperature: float = Field(description="city-centre AIR temperature, °C")
    maxTemperature: float = Field(description="max T_eff(i), °C")
    heatIslandIntensity: float
    avgEffectiveTemperature: float = Field(description="mean T_eff(i), the heat what-if baseline (B-020)")
    baselines: HeatBaselines
    hotspots: list[HeatHotspot]
    geojson: HeatGeoJSON


# ── recommend ───────────────────────────────────────────────────────────────────
class RecommendationInputs(Out):
    """The unit's value(s) the rule fired on (flood: riskScore, rainfall; R-COMB-01: riskScore, aqi,
    aqiPointId; AQI: aqi; heat: effectiveTemperature) + the π(r, i) factors. R-NORM-00 carries only
    severityBand "none"."""

    severityBand: str
    exposureE: float | None = Field(None, description="E(i) = clamp(builtUp(i), 0.1, 1)")
    feasibilityFa: float | None = Field(None, description="F(a)")
    riskScore: float | None = None
    rainfall: float | None = None
    aqi: float | None = None
    aqiPointId: str | None = None
    effectiveTemperature: float | None = None


class Recommendation(Out):
    id: str = Field(description="<ruleId>:<unitId>")
    ruleId: str
    unitId: str
    unitName: str = Field(description="toponym")
    unitKind: Literal["flood_zone", "heat_cell", "aqi_point", "city"]
    commune: str | None = Field(
        description="official 2025 commune containing the unit (§A.3): data/API only, never rendered"
    )
    priorityScore: float = Field(description="π(r, i) = S(b)·E(i)·F(a)")
    priority: Literal["low", "medium", "high", "urgent"]
    category: Literal["flood", "air", "heat", "combined"]
    title: str
    message: str
    actionItems: list[str]
    timestamp: str
    inputs: RecommendationInputs


class RecommendData(Out):
    recommendations: list[Recommendation] = Field(description="top k = 10 by π desc")
    firedCount: int = Field(description="all fired (r, i), before the top-k cut")
    # Added 2026-09-25 for the per-hazard /risks pages: `recommendations` is a CITY-WIDE top
    # k, so one hazard can crowd another out of it entirely even though the smaller hazard has
    # real, lower-priority items of its own.
    allRecommendations: list[Recommendation] = Field(description="every fired (r, i), unlike recommendations' top-k cut")
    summary: str
    overallRiskLevel: RiskLevel


class WeatherLatest(WeatherData, Latest): ...


class AQILatest(AQIData, Latest): ...


class FloodLatest(FloodData, Latest): ...


class HeatLatest(HeatData, Latest): ...


class RecommendLatest(RecommendData, Latest): ...


LATEST_MODELS: dict[str, type[Latest]] = {
    "weather": WeatherLatest,
    "aqi": AQILatest,
    "flood": FloodLatest,
    "heat": HeatLatest,
    "recommend": RecommendLatest,
}


# ── alerts ──────────────────────────────────────────────────────────────────────
AlertType = Literal["flood", "storm", "aqi", "heat"]
AlertSeverity = Literal["warning", "critical"]


class Alert(BaseModel):
    id: str = Field(description="<hazard>:<unitId>:<warning|critical>:<YYYY-MM-DDTHH local>")
    severity: AlertSeverity
    type: AlertType
    title: str
    message: str
    # Added migration 003; null on alerts raised before it (the FE falls back to `message`,
    # which stays Vietnamese-only for those — see the frontend's `alertRules` catalog).
    unitId: str | None = None
    unitName: str | None = None
    value: float | None = None
    isRead: bool
    createdAt: str
    expiresAt: str


class AlertsResponse(BaseModel):
    alerts: list[Alert]
    unreadCount: int
    totalCount: int


class MarkReadRequest(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=1000)


class MarkReadResponse(BaseModel):
    marked: int = Field(description="how many of the ids were unread and are now read")


# ── simulation ──────────────────────────────────────────────────────────────────
class Scenario(BaseModel):
    """Bounds = legacy validateScenario. Omitted/null levers take the legacy controller defaults."""

    rainfallIncrease: float = Field(50, ge=0, le=500)
    rainfallDurationHours: float = Field(3, ge=0, le=72)
    addGreenCoverage: float = Field(0, ge=-100, le=100, description="percentage points vs baseline")
    trafficReduction: float = Field(0, ge=0, le=100)
    urbanDensity: float | None = Field(None, ge=0, le=1, description="omitted = baseline density")

    @model_validator(mode="before")
    @classmethod
    def _legacy_validate(cls, data: Any) -> Any:
        # The ported validate_scenario is the single source of the rules and of the legacy error
        # messages (the gateway surfaces `msg` as the 400 `error`). It rejects bools/strings too.
        if not isinstance(data, dict):
            return data  # pydantic reports the type error
        data = dict(data)
        for k, field in cls.model_fields.items():
            if data.get(k) is None:  # JS `body.scenario?.x ?? default`
                data[k] = field.default
        if msg := validate_scenario(data):
            raise PydanticCustomError("invalid_scenario", msg)
        return data


class SimulationRequest(BaseModel):
    cityId: str = "hcmc"  # accepted and ignored: one city
    scenario: Scenario = Field(default_factory=Scenario)

    @model_validator(mode="before")
    @classmethod
    def _nulls_are_defaults(cls, data: Any) -> Any:
        return {k: v for k, v in data.items() if v is not None} if isinstance(data, dict) else data


class SimComparisonSide(BaseModel):
    riskScore: float
    affectedAreas: int


class SimComparison(BaseModel):
    before: SimComparisonSide
    after: SimComparisonSide


class SimStation(BaseModel):
    id: str
    name: str
    before: int
    after: int
    delta: int


class SimResults(BaseModel):
    floodRiskDelta: float
    newFloodAreas: list[FloodArea]
    tempDelta: float
    aqiDelta: float
    stations: list[SimStation] = Field(description="per AQI point: AQI_sim(i) (§D)")


class SimAlert(BaseModel):
    """An alert that WOULD fire on the counterfactual state (returned, never persisted)."""

    id: str
    type: AlertType
    severity: AlertSeverity
    unitId: str
    unitName: str
    value: float
    title: str
    message: str
    createdAt: str
    expiresAt: str


class BandChange(BaseModel):
    unitId: str
    name: str
    before: str
    after: str


class BandChanges(BaseModel):
    flood: list[BandChange] = Field(description="bands low / medium / high / critical")
    heat: list[BandChange] = Field(description="bands low / moderate / high / extreme")
    aqi: list[BandChange] = Field(description="AQI level codes good … hazardous")


class Counterfactual(BaseModel):
    """Algorithm 2 steps 3–6 re-run on the counterfactual state (§G)."""

    recommendations: list[Recommendation] = Field(description="top k, same shape as /v1/recommend")
    firedCount: int
    alerts: list[SimAlert]
    bandChanges: BandChanges


class SimulationResult(BaseModel):
    simulationId: str
    status: str
    results: SimResults
    comparison: SimComparison
    counterfactual: Counterfactual


# ── maturity (Algorithm 1, §H line 8) ───────────────────────────────────────────
class Criterion(BaseModel):
    name: str
    current: float
    required: float


class Stage(BaseModel):
    eligible: bool
    reason: str | None = None
    criteria: list[Criterion]


class Stages(BaseModel):
    S1: Stage
    S2: Stage
    S3: Stage


class GammaEstimate(BaseModel):
    value: float = Field(description="estimate clamped to [0, 1]")
    estimate: float = Field(description="OLS estimate, unclamped")
    se: float
    ci95: list[float] = Field(description="[lo, hi] around the unclamped estimate")


class GammaEstimates(BaseModel):
    gammaWind: GammaEstimate
    gammaRain: GammaEstimate


class S2Fit(BaseModel):
    estimates: GammaEstimates
    maeHoldout: float | None
    nTrain: int
    nHoldout: int
    promoted: bool


class HazardMaturity(BaseModel):
    hazard: Literal["flood", "heat", "aqi"]
    active: Literal["S1", "S2", "S3"]
    modelVersion: str
    stages: Stages
    s1MaeHoldout: float | None = Field(description="S1 one-step holdout MAE where V exists")
    s2: S2Fit | None = Field(description="S2 fit when eligible and fitted")


class UnitRow(BaseModel):
    """One spatial unit and its 2025 commune (spec §A.3 mapping table). Data/API only: the web
    never renders `commune`."""

    id: str
    kind: Literal["flood_zone", "heat_cell", "aqi_point"]
    name: str
    lat: float
    lng: float
    commune: str | None
    communeOsmId: int | None


class MaturityResponse(BaseModel):
    evaluatedAt: str
    windowDays: int
    deltaAqi: float
    hazards: list[HazardMaturity]


# ── history ─────────────────────────────────────────────────────────────────────
class HistoryEntry(BaseModel):
    computedAt: str
    result: dict[str, Any] = Field(description="that hazard's /latest shape as it was at computedAt")
