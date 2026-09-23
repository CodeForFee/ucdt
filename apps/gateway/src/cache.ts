import type { MiddlewareHandler } from 'hono'
import type { RedisLike } from './redis.ts'

interface CachedEntry {
  body: string
  contentType: string
}

/**
 * GET-only, 200-only response cache keyed by the full request URL, backed by
 * Redis. If Redis is unreachable the middleware fails OPEN — the request is
 * served without caching rather than failing.
 */
export function createCache(redis: RedisLike, ttlSeconds: number): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== 'GET') return next()

    const key = `gw:cache:${c.req.url}`

    try {
      const cached = await redis.get(key)
      if (cached !== null) {
        const entry = JSON.parse(cached) as CachedEntry
        return c.newResponse(entry.body, 200, {
          'Content-Type': entry.contentType,
          'X-Cache': 'HIT',
        })
      }
    } catch (err) {
      console.error('[cache] redis unavailable, failing open:', err)
    }

    await next()

    if (c.res.status === 200) {
      const contentType = c.res.headers.get('Content-Type') || 'application/json'
      const body = await c.res.clone().text()
      c.res.headers.set('X-Cache', 'MISS')
      try {
        await redis.setex(key, ttlSeconds, JSON.stringify({ body, contentType } satisfies CachedEntry))
      } catch (err) {
        console.error('[cache] redis unavailable, skip write:', err)
      }
    }
  }
}
