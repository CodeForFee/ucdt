import { useQuery } from "@tanstack/react-query";
import { fetchWeather } from "@/shared/services";
import { useCityStore } from "@/shared/stores/cityStore";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { WeatherData } from "@/shared/types/weather";

export function useWeatherData() {
  const { selectedCity } = useCityStore();
  return useQuery<WeatherData>({
    queryKey: QUERY_KEY.weather(selectedCity.id),
    queryFn: () => fetchWeather(selectedCity.lat, selectedCity.lng, selectedCity.id),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
