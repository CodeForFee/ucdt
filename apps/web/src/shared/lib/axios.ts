import axios from "axios";
import { env } from "@/config/env";

/**
 * The single Axios instance for this app. Do not construct another one — base URL,
 * timeout and response unwrapping all live here.
 */
export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 10000,
});

/**
 * The backend wraps every successful response as
 * `{ success, data, timestamp, cached }` — this peels off that envelope.
 */
export const unwrap = <T>(r: { data: { data: T } }): T => r.data.data;
