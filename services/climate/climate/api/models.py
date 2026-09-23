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


class AQIData(Out):
    aqi: float
    category: str
    pm25: float
    pm10: float
    o3: float
    no2: float
    trend: Literal["increasing", "decreasing", "stable"]
    forecast24h: list[AQIForecastItem]
    stations: list[AQIStation]


# ── flood ───────────────────────────────────────────────────────────────────────
class PolygonGeometry(Out):
    type: str
    coordinates: list[list[list[float]]]


class FloodGeoJSONFeature(Out):
    type: Literal["Feature"]
    geometry: PolygonGeometry
    properties: dict[str, Any]


class FloodArea(Out):
    id: str
    name: str
    lat: float
    lng: float
    riskLevel: RiskLevel
    riskScore: float
    estimatedDepth: float
    geojson: FloodGeoJSONFeature


class FloodTriggers(Out):
    currentRainfall: float
    soilSaturation: float
    drainageCapacity: float
    terrainSensitivity: float


class FloodData(Out):
    overallRisk: str
    riskScore: float
    affectedAreas: list[FloodArea]
    triggers: FloodTriggers


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


class HeatData(Out):
    city: str
    timestamp: str
    avgTemperature: float
    maxTemperature: float
    heatIslandIntensity: float
    hotspots: list[HeatHotspot]
    geojson: HeatGeoJSON


# ── recommend ───────────────────────────────────────────────────────────────────
class Recommendation(Out):
    id: str
    ruleId: str
    priorityScore: float
    priority: Literal["low", "medium", "high", "urgent"]
    category: Literal["flood", "air", "heat", "combined"]
    title: str
    message: str
    actionItems: list[str]
    timestamp: str
    inputs: dict[str, Any]


class RecommendData(Out):
    recommendations: list[Recommendation]
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
class Alert(BaseModel):
    id: str
    severity: Literal["info", "warning", "critical"]
    type: Literal["flood", "aqi", "heat", "storm", "system"]
    title: str
    message: str
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


class SimResults(BaseModel):
    floodRiskDelta: float
    newFloodAreas: list[FloodArea]
    tempDelta: float
    aqiDelta: float
    affectedBuildings: int
    affectedPopulation: int


class SimulationResult(BaseModel):
    simulationId: str
    status: str
    results: SimResults
    comparison: SimComparison


# ── history ─────────────────────────────────────────────────────────────────────
class HistoryEntry(BaseModel):
    computedAt: str
    result: dict[str, Any] = Field(description="that hazard's /latest shape as it was at computedAt")
