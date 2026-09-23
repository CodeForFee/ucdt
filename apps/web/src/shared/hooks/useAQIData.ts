import { useQuery } from "@tanstack/react-query";
import { fetchAQI } from "@/shared/services";
import { useCityStore } from "@/shared/stores/cityStore";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { AQIData } from "@/shared/types/aqi";

export function useAQIData() {
  const { selectedCity } = useCityStore();
  return useQuery<AQIData>({
    queryKey: QUERY_KEY.aqi(selectedCity.id),
    queryFn: () => fetchAQI(selectedCity.lat, selectedCity.lng, selectedCity.id),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
