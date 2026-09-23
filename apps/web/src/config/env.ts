import { z } from "zod";

const envSchema = z.object({
  // Empty string is VALID and is the dev default: axios/EventSource then build relative
  // URLs (/api/...) so requests go to whatever origin the page was opened on, and Vite's
  // dev proxy (or the production reverse proxy) forwards them to the gateway.
  VITE_API_BASE_URL: z.string(),
  // The map cannot render without it — Mapbox scopes tokens by URL, not by secrecy, so
  // shipping it in the client bundle is correct.
  VITE_MAPBOX_TOKEN: z.string().min(1),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error(
    `[env] Missing required environment variables:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
  );
}

export const env = parsed.data;
