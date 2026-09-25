import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { streamSSE } from 'hono/streaming'
import { forward, queryString, type ClimateDeps } from './climate.ts'
import { createCache } from './cache.ts'
import { createRateLimit } from './rateLimit.ts'
import type { RedisLike } from './redis.ts'

export interface AppDeps extends ClimateDeps {
  /** Commands: cache + rate limit. */
  redis: RedisLike
  /** Pub/sub only — a subscribed Redis connection rejects every other command (B-013). */
  subscriber: RedisLike
}

const CACHE_TTL = {
  weather: 300,
  aqi: 300,
  flood: 180,
  heat: 300,
  recommend: 120,
} as const
/** Algorithm 1 reads ≥ 7 days of hourly history; one 15-min worker run cannot move it much. */
const MATURITY_TTL = 600
const UNITS_TTL = 3600 // static catalogue: changes only with a deploy

const SSE_CHANNEL = 'ucdt:events'
const HEARTBEAT_MS = 25_000

/** Legacy simulationGetController's defaults — the GET->POST contract shape. */
function simulationBodyFromQuery(c: Context) {
  const num = (key: string, fallback: number): number => {
    const raw = c.req.query(key)
    if (raw === undefined) return fallback
    const parsed = Number.parseFloat(raw)
    return Number.isNaN(parsed) ? fallback : parsed
  }
  const density = c.req.query('urbanDensity')
  return {
    cityId: c.req.query('cityId') ?? 'hcmc',
    scenario: {
      rainfallIncrease: num('rainfallIncrease', 50),
      rainfallDurationHours: num('rainfallDurationHours', 3),
      addGreenCoverage: num('addGreenCoverage', 0),
      trafficReduction: num('trafficReduction', 0),
      urbanDensity: density === undefined ? undefined : Number.parseFloat(density),
    },
  }
}

export function createApp(deps: AppDeps) {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400,
    })
  )
  app.use('*', secureHeaders())
  app.use('*', bodyLimit({ maxSize: 64 * 1024 }))
  app.use('*', logger())
  app.use('*', createRateLimit(deps.redis))

  app.get('/', (c) =>
    c.json({
      name: 'Urban Climate Digital Twin API',
      version: '1.0.0',
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/weather',
        '/api/aqi',
        '/api/flood',
        '/api/heat',
        '/api/simulation',
        '/api/recommend',
        '/api/alerts',
        '/api/maturity',
        '/api/units',
      ],
    })
  )

  app.get('/health', (c) =>
    c.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
  )

  // ── Simple pass-through GET endpoints: /api/<x> -> GET /v1/<x>/latest ──────
  const latestRoutes: Array<[path: string, hazard: keyof typeof CACHE_TTL]> = [
    ['/api/weather', 'weather'],
    ['/api/aqi', 'aqi'],
    ['/api/flood', 'flood'],
    ['/api/heat', 'heat'],
    ['/api/recommend', 'recommend'],
  ]
  for (const [path, hazard] of latestRoutes) {
    app.get(path, createCache(deps.redis, CACHE_TTL[hazard]), (c) =>
      forward(c, deps, 'GET', `/v1/${hazard}/latest`, { query: queryString(c) })
    )
  }

  // ── Model maturity (Algorithm 1, spec §H) ─────────────────────────────────
  app.get('/api/maturity', createCache(deps.redis, MATURITY_TTL), (c) =>
    forward(c, deps, 'GET', '/v1/maturity', { query: queryString(c) })
  )

  // ── Unit -> commune mapping table (spec §A.3; data/API only) ───────────────
  app.get('/api/units', createCache(deps.redis, UNITS_TTL), (c) => forward(c, deps, 'GET', '/v1/units'))

  // ── Alerts (never cached) ───────────────────────────────────────────────────
  app.get('/api/alerts', (c) => forward(c, deps, 'GET', '/v1/alerts', { query: queryString(c) }))
  app.post('/api/alerts/read', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    return forward(c, deps, 'POST', '/v1/alerts/read', { body })
  })

  // ── Simulation ───────────────────────────────────────────────────────────────
  const runSimulation = async (c: Context) => {
    const body = await c.req.json().catch(() => ({}))
    return forward(c, deps, 'POST', '/v1/simulation', { body })
  }
  app.post('/api/simulation', runSimulation)
  app.post('/api/simulation/run', runSimulation)
  app.get('/api/simulation', (c) =>
    forward(c, deps, 'POST', '/v1/simulation', { body: simulationBodyFromQuery(c) })
  )

  // ── History ──────────────────────────────────────────────────────────────────
  app.get('/api/history/:hazard', (c) =>
    forward(c, deps, 'GET', `/v1/history/${c.req.param('hazard')}`, { query: queryString(c) })
  )

  // ── SSE stream from Redis pub/sub ───────────────────────────────────────────
  app.get('/api/stream', (c) =>
    streamSSE(c, async (stream) => {
      const listener = (message: string) => {
        let event = 'message'
        try {
          const parsed: unknown = JSON.parse(message)
          if (parsed && typeof parsed === 'object' && typeof (parsed as { type?: unknown }).type === 'string') {
            event = (parsed as { type: string }).type
          }
        } catch {
          // not JSON — keep the default event name, forward the raw message
        }
        void stream.writeSSE({ event, data: message })
      }

      let subscribed = false
      try {
        await deps.subscriber.subscribe(SSE_CHANNEL, listener)
        subscribed = true
      } catch (err) {
        console.error('[stream] redis unavailable, no live events:', err)
      }

      const heartbeat = setInterval(() => void stream.write(': heartbeat\n\n'), HEARTBEAT_MS)

      await new Promise<void>((resolve) => stream.onAbort(() => resolve()))

      clearInterval(heartbeat)
      if (subscribed) {
        try {
          await deps.subscriber.unsubscribe(SSE_CHANNEL, listener)
        } catch (err) {
          console.error('[stream] redis unsubscribe failed:', err)
        }
      }
    })
  )

  app.notFound((c) =>
    c.json({ success: false, error: 'Not found', path: c.req.path, timestamp: new Date().toISOString() }, 404)
  )

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    console.error('[gateway] unhandled error:', err)
    return c.json({ success: false, error: 'Internal server error', timestamp: new Date().toISOString() }, 500)
  })

  return app
}
