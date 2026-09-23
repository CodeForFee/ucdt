import { env } from "@/config/env";

export const MAPBOX_TOKEN = env.VITE_MAPBOX_TOKEN;
export const DEFAULT_VIEWPORT = { lat: 10.7769, lng: 106.7009, zoom: 12 };
export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";
