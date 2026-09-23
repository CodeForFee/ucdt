import { RedisClient } from 'bun'
import { createApp } from './app.ts'
import type { RedisLike } from './redis.ts'

const climateUrl = process.env.CLIMATE_URL ?? 'http://localhost:8000'
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Bun's RedisClient already implements every method RedisLike needs.
const redis: RedisLike = new RedisClient(redisUrl)
// A subscribed connection rejects every other command, so SSE gets its own (B-013).
const subscriber: RedisLike = new RedisClient(redisUrl)

const app = createApp({ climateUrl, climateFetch: fetch, redis, subscriber })

export default {
  port: Number(process.env.PORT ?? 3001),
  hostname: '0.0.0.0',
  fetch: app.fetch,
  // SSE connections (/api/stream) are long-lived — 0 disables Bun's idle timeout.
  idleTimeout: 0,
}
