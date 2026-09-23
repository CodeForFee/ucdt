import { useQuery } from "@tanstack/react-query";
import { fetchHeat } from "@/shared/services";
import { useCityStore } from "@/shared/stores/cityStore";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { HeatData } from "@/shared/types/heat";

export function useHeatMap() {
  const { selectedCity } = useCityStore();
  return useQuery<HeatData>({
    queryKey: QUERY_KEY.heat(selectedCity.id),
    queryFn: () => fetchHeat(selectedCity.lat, selectedCity.lng, selectedCity.id),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
