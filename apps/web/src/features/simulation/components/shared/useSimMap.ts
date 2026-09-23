import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN } from "@/shared/lib/mapConfig";
import { useCityStore } from "@/shared/stores/cityStore";

export const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
} as const;

export type StyleKey = keyof typeof MAP_STYLES;

/**
 * Map lifecycle for the simulation pages.
 *
 * Style changes follow a strict order to avoid a mapbox-gl placement crash
 * ("Cannot read properties of undefined (reading 'get')"):
 *   1. unmount child layers SYNCHRONOUSLY (flushSync) — their cleanup runs against the
 *      OLD style, still intact;
 *   2. only then call setStyle;
 *   3. remount child layers once the new style has finished loading (style.load).
 * Previously setStyle ran before React had unmounted the children, so
 * removeLayer/removeSource interleaved with the style swap and corrupted internal state.
 */
export function useSimMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [styleKey, setStyleKeyState] = useState<StyleKey>("dark");
  const styleKeyRef = useRef<StyleKey>("dark");
  const { selectedCity } = useCityStore();

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    let m: mapboxgl.Map;
    try {
      // No WebGL (old hardware, disabled GPU accel, or jsdom in tests) throws
      // synchronously here — leave map null forever rather than crash the route.
      m = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLES.dark,
        center: [selectedCity.lng, selectedCity.lat],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        antialias: true,
        attributionControl: false,
      });
    } catch (err) {
      console.error("[map] mapbox-gl init failed (WebGL unavailable?):", err);
      return;
    }
    mapRef.current = m;
    m.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    m.on("load", () => {
      if (mapRef.current === m) setMap(m);
    });
    return () => {
      mapRef.current = null;
      m.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (!map) return;
    map.flyTo({ center: [selectedCity.lng, selectedCity.lat], duration: 1200 });
  }, [selectedCity, map]);

  const setStyleKey = useCallback((key: StyleKey) => {
    const m = mapRef.current;
    if (!m || styleKeyRef.current === key) return;
    styleKeyRef.current = key;

    flushSync(() => {
      setStyleKeyState(key);
      setMap(null);
    });

    m.setStyle(MAP_STYLES[key]);

    m.once("style.load", () => {
      if (mapRef.current === m) setMap(m);
    });
  }, []);

  const resetView = () =>
    mapRef.current?.flyTo({ center: [selectedCity.lng, selectedCity.lat], zoom: 13, pitch: 0, bearing: 0, duration: 800 });

  const reset3DView = (pitch = 55, bearing = -17) =>
    mapRef.current?.flyTo({
      center: [selectedCity.lng, selectedCity.lat],
      zoom: 13,
      pitch,
      bearing,
      duration: 800,
    });

  return { containerRef, map, styleKey, setStyleKey, resetView, reset3DView };
}
