export interface AQIData {
  aqi: number;
  category: string;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  trend: "increasing" | "decreasing" | "stable";
  forecast24h: AQIForecastItem[];
  stations: AQIStation[];
  // optional fields from the air-quality detail page
  dominantPollutant?: string;
  trend7d?: AQITrendPoint[];
  hourlyPattern?: HourlyAQIPattern[];
}

export interface AQIForecastItem {
  hour: string;
  aqi: number;
}

export interface AQIStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  aqi: number;
  category?: string;
}

export interface AQITrendPoint {
  date: string;
  aqi: number;
}

export interface HourlyAQIPattern {
  hour: number;
  day: string;
  aqi: number;
}
