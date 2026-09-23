import { apiClient, unwrap } from "@/shared/lib/axios";
import type { WeatherData } from "@/shared/types/weather";

export const fetchWeather = (lat: number, lng: number, city: string): Promise<WeatherData> =>
  apiClient.get("/api/weather", { params: { lat, lng, city } }).then(unwrap<WeatherData>);
