import { create } from "zustand";

interface Viewport {
  lat: number;
  lng: number;
  zoom: number;
}

interface MapState {
  viewport: Viewport;
  activeLayers: string[];
  selectedPoint: { lat: number; lng: number } | null;
  popupData: Record<string, unknown> | null;
  setViewport: (v: Viewport) => void;
  toggleLayer: (name: string) => void;
  setSelectedPoint: (p: { lat: number; lng: number } | null) => void;
  setPopupData: (data: Record<string, unknown> | null) => void;
  clearPopup: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: { lat: 10.7769, lng: 106.7009, zoom: 12 },
  activeLayers: ["flood", "aqi"],
  selectedPoint: null,
  popupData: null,
  setViewport: (viewport) => set({ viewport }),
  toggleLayer: (name) =>
    set((s) => ({
      activeLayers: s.activeLayers.includes(name)
        ? s.activeLayers.filter((l) => l !== name)
        : [...s.activeLayers, name],
    })),
  setSelectedPoint: (selectedPoint) => set({ selectedPoint }),
  setPopupData: (popupData) => set({ popupData }),
  clearPopup: () => set({ selectedPoint: null, popupData: null }),
}));
