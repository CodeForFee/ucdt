import { useQuery } from "@tanstack/react-query";
import { fetchFlood } from "@/shared/services";
import { useCityStore } from "@/shared/stores/cityStore";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { FloodData } from "@/shared/types/flood";

export function useFloodRisk() {
  const { selectedCity } = useCityStore();
  return useQuery<FloodData>({
    queryKey: QUERY_KEY.flood(selectedCity.id),
    queryFn: () => fetchFlood(selectedCity.lat, selectedCity.lng, selectedCity.id),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}
