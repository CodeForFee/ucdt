import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useTranslations } from "use-intl";
import { useAQIData } from "@/shared/hooks/useAQIData";
import { aqiColor } from "@/shared/lib/aqi";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Open-monitoring-network stations (AirGradient, §I.3, §J) on the AQI simulator map. They are
 * OBSERVATIONS, so they carry no simulated value and get a marker unlike the CAMS badges:
 * white, dashed dark ring, AQI-coloured dot (see AQILegend "observed").
 */
export function ObservedStationsLayer({ map }: { map: mapboxgl.Map }) {
  const { data } = useAQIData();
  const t = useTranslations("aqiLegend");
  const stations = data?.observedStations;

  useEffect(() => {
    if (!map || !stations?.length) return;
    const markers = stations.map((s) => {
      const el = document.createElement("div");
      el.setAttribute("aria-label", `${t("observed")}: ${s.name}`);
      el.style.cssText =
        "cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px 6px;border-radius:9999px;" +
        "background:#fff;border:2px dashed #0f172a;font:700 12px Arial,sans-serif;color:#0f172a;" +
        "box-shadow:0 2px 6px rgba(0,0,0,0.35);";
      el.innerHTML = `<span style="width:8px;height:8px;border-radius:9999px;background:${aqiColor(s.aqi)}"></span>${s.aqi}`;

      const popup = new mapboxgl.Popup({ closeButton: false, offset: 12, maxWidth: "220px" }).setHTML(
        `<div style="font-family:Arial,sans-serif;padding:4px 6px;color:#1e293b">
           <div style="font-weight:700;font-size:13px">${esc(s.name)}</div>
           <div style="font-size:11px;color:#64748b;margin-bottom:4px">${esc(t("observed"))}</div>
           <div style="font-size:12px">AQI <b>${s.aqi}</b> · PM2.5 ${s.pm25} µg/m³</div>
         </div>`,
      );
      return new mapboxgl.Marker({ element: el }).setLngLat([s.lng, s.lat]).setPopup(popup).addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [map, stations, t]);

  return null;
}
