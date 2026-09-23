import { apiClient, unwrap } from "@/shared/lib/axios";
import type { FloodData } from "@/shared/types/flood";

export const fetchFlood = (lat: number, lng: number, city: string): Promise<FloodData> =>
  apiClient.get("/api/flood", { params: { lat, lng, city } }).then(unwrap<FloodData>);
