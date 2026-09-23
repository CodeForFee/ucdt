import type { MiddlewareHandler } from 'hono'
import type { RedisLike } from './redis.ts'

const WINDOW_SECONDS = 60
const MAX_REQUESTS = 100

/**
 * 100 req/min per IP, backed by Redis INCR + EXPIRE. Fails OPEN if Redis is
 * unreachable — no limit rather than a hard outage.
 */
export function createRateLimit(redis: RedisLike): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
    const key = `gw:rl:${ip}`

    let count: number
    try {
      count = await redis.incr(key)
      if (count === 1) await redis.expire(key, WINDOW_SECONDS)
    } catch (err) {
      console.error('[rateLimit] redis unavailable, failing open:', err)
      return next()
    }

    c.header('X-RateLimit-Limit', String(MAX_REQUESTS))
    c.header('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - count)))

    if (count > MAX_REQUESTS) {
      let retryAfter = WINDOW_SECONDS
      try {
        const ttl = await redis.ttl(key)
        if (ttl > 0) retryAfter = ttl
      } catch {
        // keep the WINDOW_SECONDS fallback
      }
      return c.json({ success: false, error: 'Too Many Requests', retryAfter }, 429)
    }

    return next()
  }
}
