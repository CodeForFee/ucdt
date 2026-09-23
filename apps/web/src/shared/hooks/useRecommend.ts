import { useQuery } from "@tanstack/react-query";
import { fetchRecommend } from "@/shared/services";
import { useCityStore } from "@/shared/stores/cityStore";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { RecommendData } from "@/shared/types/recommend";

export function useRecommend() {
  const { selectedCity } = useCityStore();
  return useQuery<RecommendData>({
    queryKey: QUERY_KEY.recommend(selectedCity.id),
    queryFn: () => fetchRecommend(selectedCity.id),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
