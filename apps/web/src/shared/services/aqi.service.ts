import { apiClient, unwrap } from "@/shared/lib/axios";
import type { AQIData } from "@/shared/types/aqi";

export const fetchAQI = (lat: number, lng: number, city: string): Promise<AQIData> =>
  apiClient.get("/api/aqi", { params: { lat, lng, city } }).then(unwrap<AQIData>);
