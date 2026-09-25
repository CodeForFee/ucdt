import type { components } from "@ucdt/contracts";

type S = components["schemas"];

/** `GET /api/weather` — generated from the climate OpenAPI (packages/contracts). */
export type WeatherData = S["WeatherLatest"];
export type WeatherCurrent = S["WeatherCurrent"];
export type WeatherForecastItem = S["WeatherForecastItem"];
