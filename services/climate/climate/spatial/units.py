"""The 63 spatial units of HCMC scored by UCDT: 18 flood zones, 22 heat cells, 23 AQI points.

Units are named by coordinate-anchored TOPONYMS, never by administrative units:
Resolution 1685/NQ-UBTVQH15 (2025) abolished the district tier in HCMC. `id` keeps
the historic slug as an internal key only (never displayed). Ported verbatim from
Hackathon-BE (constants.ts HCMC_FLOOD_ZONES, heat.service.ts HCMC_HEAT_CELLS,
aqi.service.ts HCMC_AQI_POINTS); S-002 §A.1 renamed the 12 heat cells that carried former
district names to the toponym of the AQI point at the same coordinates (ids unchanged).

localDrain, terrain and urbanDensity are EXPERT-JUDGEMENT constants, not measurements.
localDrain is still live, as D̃ (no open drainage dataset exists for HCMC, spec §B).
terrain and urbanDensity are superseded by the measured static layers in derived.json (spec
§A.2, §B, §C; read through climate.spatial.catalogue); once the processing layer switches over
(T-103) they stay only for the legacy-parity tests (catalogue.legacy_catalogue).
"""

from typing import Final

# 18 flood zones shared by the baseline and the what-if, so every before/after
# comparison runs on one spatial grid (Algorithm 2, step 7).
FLOOD_ZONES: Final = (
    # Core — pluvial + tidal
    {
        "id": "gz-q8-rach-ong",
        "name": "Rạch Ông",
        "lat": 10.7285,
        "lng": 106.6785,
        "localDrain": 0.30,
        "terrain": 0.60,
    },
    {
        "id": "gz-q8-kinh-doi",
        "name": "Kênh Đôi",
        "lat": 10.7180,
        "lng": 106.6650,
        "localDrain": 0.32,
        "terrain": 0.60,
    },
    {
        "id": "gz-q6-hau-giang",
        "name": "Hậu Giang",
        "lat": 10.7450,
        "lng": 106.6350,
        "localDrain": 0.38,
        "terrain": 0.60,
    },
    {
        "id": "gz-q6-binh-tien",
        "name": "Bình Tiên",
        "lat": 10.7500,
        "lng": 106.6280,
        "localDrain": 0.40,
        "terrain": 0.60,
    },
    {
        "id": "gz-bt-xvnt",
        "name": "Xô Viết Nghệ Tĩnh",
        "lat": 10.8050,
        "lng": 106.7150,
        "localDrain": 0.42,
        "terrain": 0.60,
    },
    {
        "id": "gz-bt-ung-van-khiem",
        "name": "Ung Văn Khiêm",
        "lat": 10.8100,
        "lng": 106.7050,
        "localDrain": 0.44,
        "terrain": 0.60,
    },
    {
        "id": "gz-q11-lac-long",
        "name": "Lạc Long Quân",
        "lat": 10.7640,
        "lng": 106.6430,
        "localDrain": 0.43,
        "terrain": 0.60,
    },
    {
        "id": "gz-tanbinh-tc",
        "name": "Trường Chinh",
        "lat": 10.8050,
        "lng": 106.6480,
        "localDrain": 0.46,
        "terrain": 0.60,
    },
    {
        "id": "gz-tanphu-tl",
        "name": "Kênh Tham Lương",
        "lat": 10.7880,
        "lng": 106.6200,
        "localDrain": 0.41,
        "terrain": 0.60,
    },
    {
        "id": "gz-q12-ha-lan",
        "name": "Hà Lân",
        "lat": 10.8650,
        "lng": 106.6600,
        "localDrain": 0.52,
        "terrain": 0.60,
    },
    {
        "id": "gz-govap-nguyen-oanh",
        "name": "Nguyễn Oanh",
        "lat": 10.8380,
        "lng": 106.6600,
        "localDrain": 0.50,
        "terrain": 0.60,
    },
    # South/west fringe — riverine tide + rain
    {
        "id": "gz-bc-binh-hung",
        "name": "Bình Hưng",
        "lat": 10.7050,
        "lng": 106.6750,
        "localDrain": 0.37,
        "terrain": 0.60,
    },
    {
        "id": "gz-bc-ql50",
        "name": "Quốc lộ 50",
        "lat": 10.6900,
        "lng": 106.6450,
        "localDrain": 0.39,
        "terrain": 0.60,
    },
    {
        "id": "gz-nb-phuoc-kien",
        "name": "Phước Kiển",
        "lat": 10.6980,
        "lng": 106.7380,
        "localDrain": 0.36,
        "terrain": 0.60,
    },
    {
        "id": "gz-nb-hiep-phuoc",
        "name": "Hiệp Phước",
        "lat": 10.6650,
        "lng": 106.7150,
        "localDrain": 0.34,
        "terrain": 0.60,
    },
    {
        "id": "gz-hm-dong-thanh",
        "name": "Đông Thạnh",
        "lat": 10.9050,
        "lng": 106.6200,
        "localDrain": 0.48,
        "terrain": 0.60,
    },
    # East — Saigon River tide
    {
        "id": "gz-td-tam-binh",
        "name": "Tam Bình",
        "lat": 10.8500,
        "lng": 106.7600,
        "localDrain": 0.45,
        "terrain": 0.60,
    },
    {
        "id": "gz-td-an-phu",
        "name": "An Phú",
        "lat": 10.8100,
        "lng": 106.7500,
        "localDrain": 0.47,
        "terrain": 0.60,
    },
)

# 22 heat cells. urbanDensity (0–1) is the legacy expert constant; ρ(i) = builtUp(i) from
# WorldCover replaces it (spec §C, T-103).
HEAT_CELLS: Final = (
    # Central core — very high density
    {"id": "q1", "name": "Bến Nghé", "lat": 10.7769, "lng": 106.7009, "urbanDensity": 0.97},
    {"id": "q3", "name": "Võ Văn Tần", "lat": 10.7800, "lng": 106.6900, "urbanDensity": 0.93},
    {"id": "q4", "name": "Khánh Hội", "lat": 10.7580, "lng": 106.7050, "urbanDensity": 0.91},
    {"id": "q5", "name": "Chợ Lớn", "lat": 10.7550, "lng": 106.6820, "urbanDensity": 0.90},
    {"id": "q6", "name": "Hậu Giang", "lat": 10.7480, "lng": 106.6340, "urbanDensity": 0.88},
    {"id": "q8", "name": "Phạm Thế Hiển", "lat": 10.7250, "lng": 106.6750, "urbanDensity": 0.86},
    {"id": "q10", "name": "Ba Tháng Hai", "lat": 10.7750, "lng": 106.6680, "urbanDensity": 0.87},
    {"id": "q11", "name": "Lạc Long Quân", "lat": 10.7630, "lng": 106.6530, "urbanDensity": 0.85},
    # Inner ring — high density
    {"id": "binhthanh", "name": "Đinh Bộ Lĩnh", "lat": 10.8120, "lng": 106.7120, "urbanDensity": 0.84},
    {"id": "phunhuan", "name": "Phan Xích Long", "lat": 10.7990, "lng": 106.6810, "urbanDensity": 0.89},
    {"id": "tanbinh", "name": "Lê Văn Sỹ", "lat": 10.8020, "lng": 106.6520, "urbanDensity": 0.82},
    {"id": "tanphu", "name": "Lũy Bán Bích", "lat": 10.7900, "lng": 106.6280, "urbanDensity": 0.79},
    {"id": "govap", "name": "Nguyễn Oanh", "lat": 10.8380, "lng": 106.6650, "urbanDensity": 0.77},
    {"id": "q7", "name": "Phú Mỹ Hưng", "lat": 10.7333, "lng": 106.7167, "urbanDensity": 0.72},
    {"id": "binhtan", "name": "An Lạc", "lat": 10.7450, "lng": 106.6050, "urbanDensity": 0.74},
    {"id": "q12", "name": "Thạnh Xuân", "lat": 10.8630, "lng": 106.6580, "urbanDensity": 0.67},
    # East urban area
    {"id": "thuduc", "name": "Linh Trung", "lat": 10.8700, "lng": 106.7800, "urbanDensity": 0.63},
    # Fringe — lower density
    {"id": "binhchanh", "name": "Nguyễn Văn Linh", "lat": 10.6800, "lng": 106.6200, "urbanDensity": 0.42},
    {"id": "hocmon", "name": "Quang Trung", "lat": 10.8890, "lng": 106.5950, "urbanDensity": 0.45},
    {"id": "nhabe", "name": "Phước Kiển", "lat": 10.6980, "lng": 106.7380, "urbanDensity": 0.35},
    {"id": "cangio", "name": "Cần Thạnh", "lat": 10.4120, "lng": 106.9520, "urbanDensity": 0.12},
    {"id": "cuchi", "name": "Tây Bắc", "lat": 11.0050, "lng": 106.5000, "urbanDensity": 0.28},
)

# 23 AQI reference points. NOT physical monitoring stations: every value is sampled
# from the Open-Meteo/CAMS reanalysis grid at that coordinate — a broad-scale
# screening point, not a neighbourhood measurement.
AQI_POINTS: Final = (
    {"id": "station-q1", "name": "Bến Nghé", "lat": 10.7769, "lng": 106.7009},
    {"id": "station-q3", "name": "Võ Văn Tần", "lat": 10.7800, "lng": 106.6900},
    {"id": "station-q4", "name": "Khánh Hội", "lat": 10.7580, "lng": 106.7050},
    {"id": "station-q5", "name": "Chợ Lớn", "lat": 10.7550, "lng": 106.6820},
    {"id": "station-q6", "name": "Hậu Giang", "lat": 10.7480, "lng": 106.6340},
    {"id": "station-q8", "name": "Phạm Thế Hiển", "lat": 10.7250, "lng": 106.6750},
    {"id": "station-q10", "name": "Ba Tháng Hai", "lat": 10.7750, "lng": 106.6680},
    {"id": "station-q11", "name": "Lạc Long Quân", "lat": 10.7630, "lng": 106.6530},
    {"id": "station-binhthanh", "name": "Đinh Bộ Lĩnh", "lat": 10.8120, "lng": 106.7120},
    {"id": "station-phunhuan", "name": "Phan Xích Long", "lat": 10.7990, "lng": 106.6810},
    {"id": "station-tanbinh", "name": "Lê Văn Sỹ", "lat": 10.8020, "lng": 106.6520},
    {"id": "station-tanphu", "name": "Lũy Bán Bích", "lat": 10.7900, "lng": 106.6280},
    {"id": "station-govap", "name": "Nguyễn Oanh", "lat": 10.8380, "lng": 106.6650},
    {"id": "station-q7", "name": "Phú Mỹ Hưng", "lat": 10.7333, "lng": 106.7167},
    {"id": "station-binhtan", "name": "An Lạc", "lat": 10.7450, "lng": 106.6050},
    {"id": "station-q12", "name": "Thạnh Xuân", "lat": 10.8630, "lng": 106.6580},
    {"id": "station-thuduc-lt", "name": "Linh Trung", "lat": 10.8700, "lng": 106.8000},
    {"id": "station-thuduc-an", "name": "An Phú", "lat": 10.8100, "lng": 106.7400},
    {"id": "station-hocmon", "name": "Quang Trung", "lat": 10.8890, "lng": 106.5950},
    {"id": "station-binhchanh", "name": "Nguyễn Văn Linh", "lat": 10.6800, "lng": 106.6200},
    {"id": "station-nhabe", "name": "Phước Kiển", "lat": 10.6980, "lng": 106.7380},
    {"id": "station-cuchi", "name": "Tây Bắc", "lat": 11.0050, "lng": 106.5000},
    {"id": "station-cangio", "name": "Cần Thạnh", "lat": 10.4120, "lng": 106.9520},
)

ALL_UNITS: Final = (
    *({"kind": "flood_zone", **z} for z in FLOOD_ZONES),
    *({"kind": "heat_cell", **c} for c in HEAT_CELLS),
    *({"kind": "aqi_point", **p} for p in AQI_POINTS),
)
