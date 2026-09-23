"""Rule base R: recommendations and alerts, ported from Hackathon-BE/src/services/
recommend.service.ts (getRecommendations) and alerts.service.ts (getAlerts rule firing).

Priority π(r, i) = S(b) · E(i) · F(a) with the Stage-1 exposure proxy
E(i) = min(1, 0.4 + 0.1·|affected flood zones|). The band -> priority map is uniform
(B-008): S(b)=4 urgent, 3 high, 2 medium.
"""

from datetime import datetime, timedelta

from climate.pdim.constants import PDIM_S1
from climate.pdim.risk import effective_temp, epoch_ms, js_iso, js_round, to_fixed

PRIORITY_OF_SB = {4: "urgent", 3: "high", 2: "medium", 1: "low"}


def _rec(rid, rule_id, sb, fa, category, title, message, actions, inputs, exposure, ts) -> dict:
    return {
        "id": rid,
        "ruleId": rule_id,
        "priorityScore": js_round(sb * exposure * fa * 100) / 100,
        "priority": PRIORITY_OF_SB[sb],
        "category": category,
        "title": title,
        "message": message,
        "actionItems": actions,
        "timestamp": ts,
        "inputs": {**inputs, "exposureE": exposure, "feasibilityFa": fa},
    }


def recommendations(weather: dict, flood: dict, aqi: dict, now: datetime) -> dict:
    """RecommendResponse: fired rules sorted by π descending, plus summary and overall level."""
    flood_score = flood["riskScore"]
    rainfall = weather["current"]["rainfall"]
    a = aqi["aqi"]
    temperature = weather["current"]["temperature"]
    humidity = weather["current"]["humidity"]
    eff = effective_temp(temperature, humidity, PDIM_S1["heat"]["densityBaseline"])
    top_area = flood["affectedAreas"][0]["name"] if flood["affectedAreas"] else "khu vực trung tâm"
    exposure = min(1.0, 0.4 + len(flood["affectedAreas"]) * 0.1)
    ts = js_iso(now)
    recs = []

    def fire(*args):
        recs.append(_rec(*args, exposure, ts))

    fin = {"floodScore": flood_score, "rainfall": rainfall}
    if flood_score > 0.75 and rainfall > 40:
        fire(
            "rec-flood-critical",
            "R-FLOOD-01",
            4,
            0.9,
            "flood",
            "Nguy cơ ngập nghiêm trọng",
            f"Nguy cơ ngập nghiêm trọng tại {top_area}. "
            f"Lượng mưa hiện tại {to_fixed(rainfall, 1)}mm/h vượt ngưỡng nguy hiểm.",
            [
                "Tránh di chuyển qua các khu vực trũng thấp",
                "Không đi vào đường ngập nước",
                "Di chuyển xe lên tầng cao hoặc nơi an toàn",
                "Theo dõi thông báo khẩn từ cơ quan chức năng",
                "Chuẩn bị túi đồ khẩn cấp nếu cần sơ tán",
            ],
            {**fin, "severityBand": "critical"},
        )
    elif flood_score > 0.5:
        fire(
            "rec-flood-high",
            "R-FLOOD-02",
            3,
            0.85,
            "flood",
            "Khả năng ngập trong 2 giờ tới",
            f"Khả năng ngập cao trong 2h tới tại {top_area}. Điểm rủi ro: {to_fixed(flood_score * 100, 0)}%.",
            [
                "Hạn chế di chuyển trong khung giờ mưa cao điểm",
                "Chọn đường tránh khu vực thường xuyên ngập",
                "Kiểm tra ứng dụng dự báo ngập trước khi ra đường",
                "Đặt lịch di chuyển sớm hơn thường lệ",
            ],
            {**fin, "severityBand": "high"},
        )
    elif flood_score > 0.25:
        fire(
            "rec-flood-medium",
            "R-FLOOD-03",
            2,
            0.8,
            "flood",
            "Theo dõi tình hình mưa",
            "Theo dõi tình hình mưa — có khả năng ngập nhẹ tại một số điểm nếu mưa tiếp tục.",
            [
                "Kiểm tra thời tiết trước khi ra ngoài",
                "Tránh đỗ xe ở khu vực trũng thấp",
                "Chuẩn bị áo mưa và ủng",
            ],
            {**fin, "severityBand": "medium"},
        )

    if a > 200:
        fire(
            "rec-aqi-urgent",
            "R-AQI-01",
            4,
            0.95,
            "air",
            "Chất lượng không khí rất xấu",
            f"Chất lượng không khí rất xấu (AQI {a}). Không ra ngoài trừ trường hợp khẩn cấp.",
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
            "rec-aqi-high",
            "R-AQI-02",
            3,
            0.9,
            "air",
            "AQI ở mức không lành mạnh",
            f"AQI ở mức không lành mạnh ({a}). Đeo khẩu trang N95 khi ra ngoài.",
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
            "rec-aqi-medium",
            "R-AQI-03",
            2,
            0.85,
            "air",
            "AQI ở mức trung bình",
            f"AQI ở mức trung bình ({a}). Nhóm nhạy cảm nên hạn chế hoạt động ngoài trời.",
            ["Đeo khẩu trang khi ra ngoài lâu", "Hạn chế tập thể dục cường độ cao ngoài trời"],
            {"aqi": a, "severityBand": "moderate"},
        )

    hin = {"effTemp": eff, "temperature": temperature, "humidity": humidity}
    if eff > 40:
        fire(
            "rec-heat-extreme",
            "R-HEAT-01",
            4,
            0.85,
            "heat",
            "Nắng nóng cực đoan",
            f"Nắng nóng cực đoan — nhiệt độ cảm nhận {to_fixed(eff, 1)}°C. Nguy cơ say nắng cao.",
            [
                "Tránh ra ngoài từ 10:00 - 16:00",
                "Uống ít nhất 3 lít nước mỗi ngày",
                "Mặc quần áo sáng màu, thoáng mát",
                "Không để trẻ em hoặc người già trong xe",
                "Nhận biết dấu hiệu say nắng: chóng mặt, buồn nôn",
            ],
            {**hin, "severityBand": "extreme_heat"},
        )
    elif eff > 37:
        fire(
            "rec-heat-high",
            "R-HEAT-02",
            3,
            0.8,
            "heat",
            "Nhiệt độ cao, uống đủ nước",
            f"Nhiệt độ cao ({to_fixed(eff, 1)}°C cảm nhận). Uống đủ nước và tránh nắng trực tiếp.",
            [
                "Uống ít nhất 2 lít nước mỗi ngày",
                "Đội mũ và mặc quần áo bảo vệ",
                "Nghỉ ngơi trong bóng mát",
            ],
            {**hin, "severityBand": "high_heat"},
        )

    if flood_score > 0.5 and a > 150:
        fire(
            "rec-combined",
            "R-COMB-01",
            4,
            0.95,
            "combined",
            "Đồng thời ngập lụt và ô nhiễm không khí",
            f"Tình trạng nguy hiểm kép: nguy cơ ngập cao ({to_fixed(flood_score * 100, 0)}%) "
            f"kết hợp với AQI {a}. Hạn chế ra ngoài tối đa.",
            [
                "Ở trong nhà và đóng kín cửa sổ",
                "Theo dõi thông báo khẩn từ chính quyền địa phương",
                "Chuẩn bị nước uống và thực phẩm dự trữ",
                "Sạc pin điện thoại đầy đủ",
                "Liên hệ người thân về tình trạng của bạn",
            ],
            {"floodScore": flood_score, "aqi": a, "severityBand": "combined_hazard"},
        )

    recs.sort(key=lambda r: -r["priorityScore"])  # stable, like Array.prototype.sort

    urgent = sum(r["priority"] == "urgent" for r in recs)
    high = sum(r["priority"] == "high" for r in recs)
    if urgent:
        level = "critical"
        summary = f"Cảnh báo khẩn cấp: {urgent} tình huống nguy hiểm đang được theo dõi. Cần hành động ngay."
    elif high:
        level = "high"
        summary = f"Cảnh báo cao: {high} tình huống cần chú ý. Hạn chế di chuyển không cần thiết."
    elif recs:
        level = "medium"
        summary = "Điều kiện thời tiết có một số rủi ro. Theo dõi tình hình và chuẩn bị trước."
    else:
        level = "low"
        summary = "Điều kiện thời tiết bình thường. Không có cảnh báo đặc biệt."
        # Not a member of R: no band fired, so π is undefined and it carries 0.
        recs.append(
            {
                "id": "rec-normal",
                "ruleId": "R-NORM-00",
                "priorityScore": 0,
                "priority": "low",
                "category": "combined",
                "title": "Điều kiện bình thường",
                "message": "Thời tiết và chất lượng không khí trong ngưỡng an toàn.",
                "actionItems": ["Tiếp tục theo dõi thường xuyên"],
                "timestamp": ts,
                "inputs": {
                    "floodScore": flood_score,
                    "aqi": a,
                    "effTemp": eff,
                    "severityBand": "none",
                    "exposureE": exposure,
                },
            }
        )
    return {"recommendations": recs, "summary": summary, "overallRiskLevel": level}


def new_alerts(weather: dict, flood: dict, aqi: dict, now: datetime, active: list) -> list:
    """Alerts to add to the queue now. `active` = current unexpired queue (dedupe by type).

    A flood/aqi/storm alert fires only if no UNREAD alert of that type is active; the
    system alert only if none is active at all. Ids are `alert-<epoch ms>-<n>`, with n
    continuing after `active` so ids stay unique within one queue.
    """
    created = js_iso(now)
    out = []

    def unread(kind):
        return any(x["type"] == kind and not x["isRead"] for x in active)

    def push(severity, kind, title, message, hours, is_read=False):
        out.append(
            {
                "id": f"alert-{epoch_ms(now)}-{len(active) + len(out) + 1}",
                "severity": severity,
                "type": kind,
                "title": title,
                "message": message,
                "isRead": is_read,
                "createdAt": created,
                "expiresAt": js_iso(now + timedelta(hours=hours)),
            }
        )

    score = flood["riskScore"]
    if not unread("flood"):
        if score > 0.75:
            push(
                "critical",
                "flood",
                "Cảnh báo ngập lụt nghiêm trọng",
                f"Nguy cơ ngập cao tại {len(flood['affectedAreas'])} khu vực. "
                f"Điểm rủi ro: {to_fixed(score * 100, 0)}%.",
                2,
            )
        elif score > 0.5:
            names = ", ".join(x["name"] for x in flood["affectedAreas"][:2])
            push("warning", "flood", "Cảnh báo nguy cơ ngập", f"Có thể xảy ra ngập tại {names}.", 3)

    a = aqi["aqi"]
    if not unread("aqi"):
        if a > 200:
            push(
                "critical",
                "aqi",
                "Ô nhiễm không khí nghiêm trọng",
                f"AQI = {a} — Mức rất không lành mạnh. Hạn chế ra ngoài.",
                4,
            )
        elif a > 150:
            push(
                "warning",
                "aqi",
                "Chất lượng không khí kém",
                f"AQI = {a} — Không tốt cho nhóm nhạy cảm. Đeo khẩu trang N95.",
                6,
            )

    rain = weather["current"]["rainfall"]
    if not unread("storm") and rain > 30:
        heavy = rain > 50
        push(
            "critical" if heavy else "warning",
            "storm",
            "Mưa rất lớn" if heavy else "Mưa lớn",
            f"Lượng mưa hiện tại: {to_fixed(rain, 1)}mm/h. "
            + ("Hạn chế ra đường." if heavy else "Cẩn thận khi di chuyển."),
            1,
        )

    if not any(x["type"] == "system" for x in active):
        push(
            "info",
            "system",
            "Hệ thống theo dõi đang hoạt động",
            "UCDT đang cập nhật dữ liệu theo thời gian thực. Dữ liệu làm mới mỗi 5 phút.",
            24,
            is_read=True,
        )
    return out
