import { apiClient, unwrap } from "@/shared/lib/axios";
import type { HeatData } from "@/shared/types/heat";

export const fetchHeat = (lat: number, lng: number, city: string): Promise<HeatData> =>
  apiClient.get("/api/heat", { params: { lat, lng, city } }).then(unwrap<HeatData>);
