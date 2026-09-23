import { apiClient, unwrap } from "@/shared/lib/axios";
import type { RecommendData } from "@/shared/types/recommend";

export const fetchRecommend = (city: string): Promise<RecommendData> =>
  apiClient.get("/api/recommend", { params: { city } }).then(unwrap<RecommendData>);
