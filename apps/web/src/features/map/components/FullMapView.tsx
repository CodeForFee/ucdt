import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_TOKEN, MAP_STYLE } from "@/shared/lib/mapConfig";
import { useMapStore } from "@/shared/stores/mapStore";
import { useCityStore } from "@/shared/stores/cityStore";
import { FloodLayer } from "./FloodLayer";
import { AQILayer } from "./AQILayer";
import { HeatLayer } from "./HeatLayer";
import { TrafficLayer } from "./TrafficLayer";
import { BuildingLayer3D } from "@/shared/components/map/BuildingLayer3D";
import { TerrainLayer } from "@/shared/components/map/TerrainLayer";
import { MapBootOverlay } from "@/shared/components/map/MapBootOverlay";

export function FullMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const { viewport, setViewport } = useMapStore();
  const { selectedCity } = useCityStore();

  useEffect(() => {
    if (!containerRef.current || map || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    let m: mapboxgl.Map;
    try {
      // A real browser without WebGL (old hardware, disabled GPU accel) — and jsdom in
      // tests — throws synchronously here. Leaving `map` null forever just keeps
      // MapBootOverlay up instead of crashing the route.
      m = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [viewport.lng, viewport.lat],
        zoom: viewport.zoom,
        attributionControl: false,
      });
    } catch {
      return;
    }

    m.addControl(new mapboxgl.NavigationControl(), "top-right");
    m.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    m.on("move", () => {
      const c = m.getCenter();
      setViewport({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
    });

    m.on("load", () => setMap(m));

    return () => {
      m.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the city changes
  }, [selectedCity]);

  useEffect(() => {
    if (!map) return;
    map.flyTo({ center: [selectedCity.lng, selectedCity.lat], zoom: 12, duration: 1500 });
  }, [selectedCity, map]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className={`w-full h-full transition-opacity duration-300 ${map ? "opacity-100" : "opacity-0"}`} />
      {!map && <MapBootOverlay />}
      {map && (
        <>
          <TerrainLayer map={map} />
          <BuildingLayer3D map={map} />
          <FloodLayer map={map} />
          <AQILayer map={map} />
          <HeatLayer map={map} />
          <TrafficLayer map={map} />
        </>
      )}
    </div>
  );
}
