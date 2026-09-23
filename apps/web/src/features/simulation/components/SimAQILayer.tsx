import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { useTranslations } from "use-intl";
import type { SimulationResult } from "@/shared/types/simulation";

interface SimAQILayerProps {
  map: mapboxgl.Map;
  /** Mutation data from useSimulation() — undefined until a POST /api/simulation
   *  lands, in which case no simulated badge is drawn (DP3: no local AQI formula here,
   *  unlike legacy's shared/lib/pdim.ts). */
  result?: SimulationResult;
}

function aqiColor(aqi: number) {
  if (aqi <= 50) return { bg: "#009966", text: "#fff" };
  if (aqi <= 100) return { bg: "#ffde33", text: "#333" };
  if (aqi <= 150) return { bg: "#ff9933", text: "#fff" };
  if (aqi <= 200) return { bg: "#cc0033", text: "#fff" };
  if (aqi <= 300) return { bg: "#660099", text: "#fff" };
  return { bg: "#7e0023", text: "#fff" };
}

function aqiLevel(
  aqi: number,
  tAqi: (k: "good" | "moderate" | "sensitive" | "unhealthy" | "veryUnhealthy" | "hazardous") => string,
): string {
  if (aqi <= 50) return tAqi("good");
  if (aqi <= 100) return tAqi("moderate");
  if (aqi <= 150) return tAqi("sensitive");
  if (aqi <= 200) return tAqi("unhealthy");
  if (aqi <= 300) return tAqi("veryUnhealthy");
  return tAqi("hazardous");
}

// AQICN-style marker: rounded badge + downward triangle pointer.
function buildMarkerEl(aqi: number, simAqi: number | null, isCity: boolean): HTMLElement {
  const { bg, text } = aqiColor(aqi);
  const hasSim = simAqi !== null && simAqi !== aqi;
  const { bg: simBg, text: simText } = hasSim ? aqiColor(simAqi!) : { bg: "", text: "" };

  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;display:flex;flex-direction:column;align-items:center;";

  const badge = document.createElement("div");
  badge.style.cssText = `
    background:${bg};
    color:${text};
    font-family:Arial,sans-serif;
    font-size:${isCity ? "17px" : "15px"};
    font-weight: 800;
    padding:${isCity ? "6px 14px" : "4px 10px"};
    border-radius:6px;
    border:2.5px solid rgba(255,255,255,0.7);
    box-shadow:0 4px 12px rgba(0,0,0,0.45);
    line-height:1;
    white-space:nowrap;
    display:flex;align-items:center;gap:4px;
    position:relative;
  `;
  badge.textContent = String(aqi);

  if (hasSim) {
    const sep = document.createElement("span");
    sep.style.cssText = "color:rgba(255,255,255,0.6);font-size:10px;";
    sep.textContent = "→";
    badge.appendChild(sep);

    const simSpan = document.createElement("span");
    simSpan.style.cssText = `
      background:${simBg};
      color:${simText};
      padding:1px 5px;
      border-radius:3px;
      border:1px solid #facc15;
      font-size:${isCity ? "14px" : "12px"};
    `;
    simSpan.textContent = String(simAqi);
    badge.appendChild(simSpan);
  }

  const triangle = document.createElement("div");
  triangle.style.cssText = `
    width:0;height:0;
    border-left:5px solid transparent;
    border-right:5px solid transparent;
    border-top:6px solid ${bg};
    margin-top:-1px;
  `;

  el.appendChild(badge);
  el.appendChild(triangle);
  return el;
}

export function SimAQILayer({ map, result }: SimAQILayerProps) {
  const { data } = useAQIData();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const tAqi = useTranslations("aqi");

  // The backend's aqiDelta is a single city-aggregate number (Section 4.2 doesn't score
  // per-station what-ifs). Broadcasting it to every marker is the DP3-safe simplification
  // for a station-level heatmap; swap for a per-station API field if Stage 2 adds one.
  const aqiDelta = result?.results?.aqiDelta ?? null;

  useEffect(() => {
    if (!map || !data) return;

    markersRef.current.forEach((m) => m.remove());
    popupsRef.current.forEach((p) => p.remove());
    markersRef.current = [];
    popupsRef.current = [];

    const points: Array<{ name: string; lat: number; lng: number; aqi: number; isCity?: boolean }> = [
      { name: "TP. Hồ Chí Minh (Trung tâm)", lat: 10.7769, lng: 106.7009, aqi: data.aqi, isCity: true },
      ...(data.stations ?? []).map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, aqi: s.aqi })),
    ];

    for (const point of points) {
      const base = point.aqi;
      const simVal = aqiDelta !== null ? Math.max(0, Math.round(base + aqiDelta)) : null;

      const isCity = !!point.isCity;
      const el = buildMarkerEl(base, simVal, isCity);

      const delta = simVal !== null ? simVal - base : 0;
      const deltaStr = delta === 0 ? "" : ` (${delta > 0 ? "+" : ""}${delta})`;
      const { bg: popBg, text: popText } = aqiColor(base);
      const { bg: simPopBg } = simVal !== null ? aqiColor(simVal) : { bg: "" };

      const popupHTML = `
        <div style="font-family:Arial,sans-serif; display:flex; flex-direction:column; align-items:center; padding:6px 10px; text-align:center; min-width:140px;">
          <div style="font-weight:700; font-size:14px; margin-bottom:12px; color:#1e293b; width:100%; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">${isCity ? "TP. Hồ Chí Minh" : point.name}</div>
          <div style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:10px;">
            <div style="background:${popBg}; color:${popText}; font-weight:700; font-size:22px; width:54px; height:54px; display:flex; align-items:center; justify-content:center; border-radius:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">${base}</div>
            ${
              simVal !== null && simVal !== base
                ? `
              <span style="color:#94a3b8; font-size:18px; font-weight:500;">→</span>
              <div style="position:relative; display:flex; align-items:center;">
                <div style="background:${simPopBg}; color:#fff; font-weight:700; font-size:22px; width:54px; height:54px; display:flex; align-items:center; justify-content:center; border-radius:10px; border:2px solid #facc15; box-shadow: 0 4px 12px rgba(250,204,21,0.2);">${simVal}</div>
                <div style="position:absolute; left: 100%; margin-left: 8px; font-size:12px; font-weight:800; color:${delta < 0 ? "#16a34a" : "#dc2626"}; white-space:nowrap;">${deltaStr}</div>
              </div>
            `
                : ""
            }
          </div>
          <div style="font-size:12px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:4px;">
            <span>${aqiLevel(base, tAqi)}</span>
            ${simVal !== null && simVal !== base ? `<span style="opacity:0.4">→</span><span>${aqiLevel(simVal, tAqi)}</span>` : ""}
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({ closeButton: false, offset: [0, -8], maxWidth: "220px" }).setHTML(popupHTML);

      el.addEventListener("click", () => {
        if (popup.isOpen()) {
          popup.remove();
        } else {
          popupsRef.current.forEach((p) => p.remove());
          popup.addTo(map);
        }
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" }).setLngLat([point.lng, point.lat]).setPopup(popup).addTo(map);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      popupsRef.current.forEach((p) => p.remove());
      markersRef.current = [];
      popupsRef.current = [];
    };
  }, [map, data, aqiDelta, tAqi]);

  return null;
}
