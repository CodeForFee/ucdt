"""Rule base ℛ fired PER UNIT (spec §E) and per-unit band-rise alerts (spec §F).

Both read `unit_values(flood, aqi, heat)`: the per-unit values of the SERVED payloads, so a run,
its predecessor snapshot and a counterfactual (§G) are compared at the same rounding.

π(r, i) = S(b)·E(i)·F(a), E(i) = clamp(builtUp(i), 0.1, 1) — built-up share as a building-exposure
proxy, NOT population (Stage 2). S(b) 4/3/2 → urgent/high/medium (uniform, B-008).
"""

from datetime import datetime, timedelta

from climate.pdim.constants import (
    DEFAULT_CITY,
    LOCAL_UTC_OFFSET_H,
    RECOMMEND_TOP_K,
    get_aqi_category,
)
from climate.pdim.risk import as_utc, clamp, js_iso, js_round, to_fixed
from climate.spatial.catalogue import Catalogue

PRIORITY_OF_SB = {4: "urgent", 3: "high", 2: "medium", 1: "low"}


def unit_values(flood: dict | None, aqi: dict | None, heat: dict | None) -> dict:
    """{"flood": {zoneId: {riskScore, rainfall}}, "aqi": {pointId: AQI}, "heat": {cellId: T_eff}}.

    Only reported flood zones (R_f ≥ 0.15) appear; an absent unit is band low. A snapshot written
    before S-002 has no per-zone rainfall, read as 0."""
    flood, aqi, heat = flood or {}, aqi or {}, heat or {}
    return {
        "flood": {
            a["id"]: {"riskScore": a["riskScore"], "rainfall": a.get("rainfall", 0)}
            for a in flood.get("affectedAreas", [])
        },
        "aqi": {s["id"]: s["aqi"] for s in aqi.get("stations", [])},
        "heat": {h["id"]: h["temperature"] for h in heat.get("hotspots", [])},
    }


def _pct(score: float) -> str:
    return to_fixed(score * 100, 0)


# ── §E rule base ─────────────────────────────────────────────────────────────
def recommendations(values: dict, cat: Catalogue, now: datetime, k: int = RECOMMEND_TOP_K) -> dict:
    """RecommendResponse: every fired (r, i) ranked by π desc (ties: ruleId, unit name), top k,
    `firedCount` = all fired; R-NORM-00 (π = 0, not in ℛ) when nothing fires."""
    ts = js_iso(now)
    fired = []

    def fire(unit, kind, rule_id, sb, fa, category, title, message, actions, inputs):
        e = clamp(unit.built_up, 0.1, 1)
        fired.append(
            {
                "id": f"{rule_id}:{unit.id}",
                "ruleId": rule_id,
                "unitId": unit.id,
                "unitName": unit.name,
                "unitKind": kind,
                "commune": unit.commune,
                "priorityScore": js_round(sb * e * fa * 100) / 100,
                "priority": PRIORITY_OF_SB[sb],
                "category": category,
                "title": title,
                "message": message,
                "actionItems": actions,
                "timestamp": ts,
                "inputs": {**inputs, "exposureE": e, "feasibilityFa": fa},
            }
        )

    for z in cat.flood_zones:
        v = values["flood"].get(z.id)
        if v is None:
            continue
        r, p, name = v["riskScore"], v["rainfall"], z.name
        fin = {"riskScore": r, "rainfall": p}
        if r > 0.75 and p > 40:
            fire(
                z,
                "flood_zone",
                "R-FLOOD-01",
                4,
                0.9,
                "flood",
                "Nguy cơ ngập nghiêm trọng",
                f"Nguy cơ ngập nghiêm trọng tại {name}: điểm rủi ro {_pct(r)}%, "
                f"lượng mưa {to_fixed(p, 1)}mm/h vượt ngưỡng nguy hiểm.",
                [
                    "Tránh di chuyển qua các khu vực trũng thấp",
                    "Không đi vào đường ngập nước",
                    "Di chuyển xe lên tầng cao hoặc nơi an toàn",
                    "Theo dõi thông báo khẩn từ cơ quan chức năng",
                    "Chuẩn bị túi đồ khẩn cấp nếu cần sơ tán",
                ],
                {**fin, "severityBand": "critical"},
            )
        elif r > 0.5:
            fire(
                z,
                "flood_zone",
                "R-FLOOD-02",
                3,
                0.85,
                "flood",
                "Khả năng ngập trong 2 giờ tới",
                f"Khả năng ngập cao trong 2h tới tại {name}. Điểm rủi ro: {_pct(r)}%.",
                [
                    "Hạn chế di chuyển trong khung giờ mưa cao điểm",
                    "Chọn đường tránh khu vực thường xuyên ngập",
                    "Kiểm tra ứng dụng dự báo ngập trước khi ra đường",
                    "Đặt lịch di chuyển sớm hơn thường lệ",
                ],
                {**fin, "severityBand": "high"},
            )
        elif r > 0.25:
            fire(
                z,
                "flood_zone",
                "R-FLOOD-03",
                2,
                0.8,
                "flood",
                "Theo dõi tình hình mưa",
                f"Theo dõi tình hình mưa tại {name} (điểm rủi ro {_pct(r)}%) — "
                "có khả năng ngập nhẹ nếu mưa tiếp tục.",
                [
                    "Kiểm tra thời tiết trước khi ra ngoài",
                    "Tránh đỗ xe ở khu vực trũng thấp",
                    "Chuẩn bị áo mưa và ủng",
                ],
                {**fin, "severityBand": "medium"},
            )
        m = cat.flood_to_aqi[z.id]
        a = values["aqi"].get(m)
        if r > 0.5 and a is not None and a > 150:
            fire(
                z,
                "flood_zone",
                "R-COMB-01",
                4,
                0.95,
                "combined",
                "Đồng thời ngập lụt và ô nhiễm không khí",
                f"Tình trạng nguy hiểm kép tại {name}: nguy cơ ngập cao ({_pct(r)}%) "
                f"kết hợp với AQI {a} tại {cat.aqi_point(m).name}. Hạn chế ra ngoài tối đa.",
                [
                    "Ở trong nhà và đóng kín cửa sổ",
                    "Theo dõi thông báo khẩn từ chính quyền địa phương",
                    "Chuẩn bị nước uống và thực phẩm dự trữ",
                    "Sạc pin điện thoại đầy đủ",
                    "Liên hệ người thân về tình trạng của bạn",
                ],
                {"riskScore": r, "aqi": a, "aqiPointId": m, "severityBand": "combined_hazard"},
            )

    for pt in cat.aqi_points:
        a = values["aqi"].get(pt.id)
        if a is None:
            continue
        name = pt.name
        if a > 200:
            fire(
                pt,
                "aqi_point",
                "R-AQI-01",
                4,
                0.95,
                "air",
                "Chất lượng không khí rất xấu",
                f"Chất lượng không khí rất xấu tại {name} (AQI {a}). Không ra ngoài trừ trường hợp khẩn cấp.",
                [
                    "Ở trong nhà, đóng cửa sổ",
                    "Sử dụng máy lọc không khí",
                    "Không tập thể dục ngoài trời",
                    "Đeo khẩu trang N95 nếu buộc phải ra ngoài",
                    "Trẻ em, người già và bệnh nhân hô hấp cần đặc biệt chú ý",
                ],
                {"aqi": a, "severityBand": "very_unhealthy"},
            )
        elif a > 150:
            fire(
                pt,
                "aqi_point",
                "R-AQI-02",
                3,
                0.9,
                "air",
                "AQI ở mức không lành mạnh",
                f"AQI tại {name} ở mức không lành mạnh ({a}). Đeo khẩu trang N95 khi ra ngoài.",
                [
                    "Đeo khẩu trang N95 hoặc KN95",
                    "Hạn chế hoạt động mạnh ngoài trời",
                    "Nhóm nhạy cảm nên ở trong nhà",
                    "Uống nhiều nước",
                ],
                {"aqi": a, "severityBand": "unhealthy"},
            )
        elif a > 100:
            fire(
                pt,
                "aqi_point",
                "R-AQI-03",
                2,
                0.85,
                "air",
                "AQI không tốt cho nhóm nhạy cảm",
                f"AQI tại {name} là {a}. Nhóm nhạy cảm nên hạn chế hoạt động ngoài trời.",
                ["Đeo khẩu trang khi ra ngoài lâu", "Hạn chế tập thể dục cường độ cao ngoài trời"],
                {"aqi": a, "severityBand": "unhealthy_sensitive"},
            )

    for c in cat.heat_cells:
        t = values["heat"].get(c.id)
        if t is None:
            continue
        if t > 40:
            fire(
                c,
                "heat_cell",
                "R-HEAT-01",
                4,
                0.85,
                "heat",
                "Nắng nóng cực đoan",
                f"Nắng nóng cực đoan tại {c.name} — nhiệt độ hiệu dụng {to_fixed(t, 1)}°C. "
                "Nguy cơ say nắng cao.",
                [
                    "Tránh ra ngoài từ 10:00 - 16:00",
                    "Uống ít nhất 3 lít nước mỗi ngày",
                    "Mặc quần áo sáng màu, thoáng mát",
                    "Không để trẻ em hoặc người già trong xe",
                    "Nhận biết dấu hiệu say nắng: chóng mặt, buồn nôn",
                ],
                {"effectiveTemperature": t, "severityBand": "extreme_heat"},
            )
        elif t > 37:
            fire(
                c,
                "heat_cell",
                "R-HEAT-02",
                3,
                0.8,
                "heat",
                "Nhiệt độ cao, uống đủ nước",
                f"Nhiệt độ hiệu dụng tại {c.name} cao ({to_fixed(t, 1)}°C). "
                "Uống đủ nước và tránh nắng trực tiếp.",
                [
                    "Uống ít nhất 2 lít nước mỗi ngày",
                    "Đội mũ và mặc quần áo bảo vệ",
                    "Nghỉ ngơi trong bóng mát",
                ],
                {"effectiveTemperature": t, "severityBand": "high_heat"},
            )

    fired.sort(key=lambda r: (-r["priorityScore"], r["ruleId"], r["unitName"]))

    urgent = sum(r["priority"] == "urgent" for r in fired)
    high = sum(r["priority"] == "high" for r in fired)
    if urgent:
        level = "critical"
        summary = f"Cảnh báo khẩn cấp: {urgent} tình huống nguy hiểm đang được theo dõi. Cần hành động ngay."
    elif high:
        level = "high"
        summary = f"Cảnh báo cao: {high} tình huống cần chú ý. Hạn chế di chuyển không cần thiết."
    elif fired:
        level = "medium"
        summary = "Điều kiện thời tiết có một số rủi ro. Theo dõi tình hình và chuẩn bị trước."
    else:
        level = "low"
        summary = "Điều kiện thời tiết bình thường. Không có cảnh báo đặc biệt."
    top = fired[:k] or [
        # Not a member of ℛ: no band fired, so π is undefined and it carries 0.
        {
            "id": "R-NORM-00:city",
            "ruleId": "R-NORM-00",
            "unitId": "city",
            "unitName": DEFAULT_CITY["name"],
            "unitKind": "city",
            "commune": None,
            "priorityScore": 0,
            "priority": "low",
            "category": "combined",
            "title": "Điều kiện bình thường",
            "message": "Thời tiết và chất lượng không khí trong ngưỡng an toàn tại mọi đơn vị không gian.",
            "actionItems": ["Tiếp tục theo dõi thường xuyên"],
            "timestamp": ts,
            "inputs": {"severityBand": "none"},
        }
    ]
    return {"recommendations": top, "firedCount": len(fired), "summary": summary, "overallRiskLevel": level}


# ── §F per-unit band-rise alerts ─────────────────────────────────────────────
SEVERITY = (None, "warning", "critical")
# hazard -> (unit kind in the catalogue, warning threshold, critical threshold, expiry h warning, critical)
ALERT_BANDS = {
    "flood": ("flood_zones", 0.50, 0.75, 3, 2),
    "storm": ("flood_zones", 30, 50, 1, 1),
    "aqi": ("aqi_points", 150, 200, 6, 4),
    "heat": ("heat_cells", 37, 40, 6, 6),
}


def _band(value: float, warn: float, crit: float) -> int:
    return 2 if value > crit else 1 if value > warn else 0


def alert_bands(values: dict) -> dict[tuple[str, str], tuple[int, float]]:
    """(hazard, unitId) -> (alert band 0/1/2, value) for every unit present in `values`."""
    series = {
        "flood": {i: v["riskScore"] for i, v in values["flood"].items()},
        "storm": {i: v["rainfall"] for i, v in values["flood"].items()},
        "aqi": values["aqi"],
        "heat": values["heat"],
    }
    return {
        (h, i): (_band(x, ALERT_BANDS[h][1], ALERT_BANDS[h][2]), x)
        for h, s in series.items()
        for i, x in s.items()
    }


def _text(hazard: str, band: int, name: str, x: float) -> tuple[str, str]:
    crit = band == 2
    if hazard == "flood":
        title = "Cảnh báo ngập lụt nghiêm trọng" if crit else "Cảnh báo nguy cơ ngập"
        return title, f"Nguy cơ ngập {'rất ' if crit else ''}cao tại {name}. Điểm rủi ro: {_pct(x)}%."
    if hazard == "storm":
        tail = "Hạn chế ra đường." if crit else "Cẩn thận khi di chuyển."
        return ("Mưa rất lớn" if crit else "Mưa lớn"), f"Lượng mưa tại {name}: {to_fixed(x, 1)}mm/h. {tail}"
    if hazard == "aqi":
        title = "Ô nhiễm không khí nghiêm trọng" if crit else "Chất lượng không khí kém"
        tail = "Hạn chế ra ngoài." if crit else "Đeo khẩu trang N95."
        return title, f"AQI tại {name} = {x} — {get_aqi_category(x)}. {tail}"
    title = "Nắng nóng cực đoan" if crit else "Nắng nóng"
    return title, f"Nhiệt độ hiệu dụng tại {name}: {to_fixed(x, 1)}°C. Uống đủ nước, tránh nắng trực tiếp."


def band_alerts(values: dict, previous: dict, cat: Catalogue, now: datetime) -> list[dict]:
    """Alerts for every unit whose band ROSE into warning/critical vs `previous` (missing → low).

    id `<hazard>:<unitId>:<band>:<YYYY-MM-DDTHH local>` (stored ON CONFLICT DO NOTHING). The
    counterfactual (§G) calls this with the simulated values against the current ones."""
    before = alert_bands(previous)
    local_hour = (as_utc(now) + timedelta(hours=LOCAL_UTC_OFFSET_H)).strftime("%Y-%m-%dT%H")
    names = {
        kind: {u.id: u.name for u in getattr(cat, kind)}
        for kind in ("flood_zones", "aqi_points", "heat_cells")
    }
    out = []
    for (hazard, unit_id), (band, x) in alert_bands(values).items():
        if band <= before.get((hazard, unit_id), (0, None))[0]:
            continue
        kind, *_, warn_h, crit_h = ALERT_BANDS[hazard]
        severity = SEVERITY[band]
        name = names[kind].get(unit_id, unit_id)
        title, message = _text(hazard, band, name, x)
        out.append(
            {
                "id": f"{hazard}:{unit_id}:{severity}:{local_hour}",
                "type": hazard,
                "severity": severity,
                "unitId": unit_id,
                "unitName": name,
                "title": title,
                "message": message,
                "createdAt": js_iso(now),
                "expiresAt": js_iso(now + timedelta(hours=crit_h if band == 2 else warn_h)),
            }
        )
    return out
