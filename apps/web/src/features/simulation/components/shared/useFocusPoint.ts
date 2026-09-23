import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useSimulationStore } from "@/shared/stores/simulationStore";

/** Flies the map to a sidebar-selected zone/station and opens its popup, then clears
 *  the request from the store (a one-shot command, not persistent state). */
export function useFocusPoint(map: mapboxgl.Map | null) {
  const { focusPoint, setFocusPoint } = useSimulationStore();
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  useEffect(() => {
    if (!map || !focusPoint) return;

    popupRef.current?.remove();
    popupRef.current = null;

    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: focusPoint.zoom ?? 14,
      duration: 900,
      essential: true,
    });

    if (focusPoint.popupHtml) {
      const html = focusPoint.popupHtml;
      const coords: [number, number] = [focusPoint.lng, focusPoint.lat];
      map.once("moveend", () => {
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "260px",
          offset: 12,
        })
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
      });
    }

    setFocusPoint(null);
  }, [focusPoint, map, setFocusPoint]);

  useEffect(() => {
    return () => {
      popupRef.current?.remove();
    };
  }, []);
}
