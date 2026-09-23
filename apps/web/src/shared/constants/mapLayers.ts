export interface MapLayerConfig {
  id: string;
  label: string;
  labelVi: string;
  color: string;
  enabled: boolean;
  type: "fill" | "circle" | "heatmap" | "line" | "symbol";
}

export const MAP_LAYERS: MapLayerConfig[] = [
  {
    id: "flood",
    label: "Flood Risk",
    labelVi: "Nguy cơ ngập lụt",
    color: "#3b82f6",
    enabled: true,
    type: "fill",
  },
  {
    id: "aqi",
    label: "Air Quality",
    labelVi: "Chất lượng không khí",
    color: "#22c55e",
    enabled: true,
    type: "circle",
  },
  {
    id: "heat",
    label: "Heat Map",
    labelVi: "Bản đồ nhiệt",
    color: "#ef4444",
    enabled: false,
    type: "heatmap",
  },
  {
    id: "traffic",
    label: "Traffic",
    labelVi: "Giao thông",
    color: "#f97316",
    enabled: false,
    type: "line",
  },
];
