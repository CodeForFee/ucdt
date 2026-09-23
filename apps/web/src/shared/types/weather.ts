// Matches BE WeatherResponse exactly
export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherForecastItem[];
}

export interface WeatherCurrent {
  temperature: number;
  feelsLike: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  windDirection: number;
  condition: string;
  timestamp: string;
}

export interface WeatherForecastItem {
  hour: string;
  temperature: number;
  rainfall: number;
  stormProbability: number;
}
