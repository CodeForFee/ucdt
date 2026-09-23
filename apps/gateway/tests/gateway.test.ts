import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { createFakeClimateFetch, createFakeRedis, jsonResponse } from './fakes.ts'

function appWith(handler: Parameters<typeof createFakeClimateFetch>[0]) {
  return createApp({
    climateUrl: 'http://climate.internal',
    climateFetch: createFakeClimateFetch(handler),
    redis: createFakeRedis(),
    subscriber: createFakeRedis(),
  })
}

describe('legacy envelope', () => {
  test('wraps a bare climate body in {success,data,timestamp,cached}', async () => {
    const app = appWith((url) => {
      expect(url.pathname).toBe('/v1/weather/latest')
      return jsonResponse({ tempC: 31.2 })
    })

    const res = await app.request('/api/weather?lat=10.7&lng=106.7')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      success: true,
      data: { tempC: 31.2 },
      timestamp: expect.any(String),
      cached: false,
    })
  })

  test('forwards the query string untouched', async () => {
    const app = appWith((url) => {
      expect(url.search).toBe('?lat=10.7&lng=106.7')
      return jsonResponse({ ok: true })
    })
    const res = await app.request('/api/aqi?lat=10.7&lng=106.7')
    expect(res.status).toBe(200)
  })
})

describe('error shapes', () => {
  test('unknown route -> legacy 404 body', async () => {
    const app = appWith(() => jsonResponse({}))
    const res = await app.request('/nope')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ success: false, error: 'Not found', path: '/nope', timestamp: expect.any(String) })
    expect('code' in body).toBe(false)
  })

  test('climate 404 -> gateway 404 in the same shape', async () => {
    const app = appWith(() => jsonResponse({ detail: 'not found' }, 404))
    const res = await app.request('/api/flood')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Not found')
  })

  test('climate 422 -> gateway 400 with the validation message as `error`', async () => {
    const app = appWith(() =>
      jsonResponse({ detail: [{ loc: ['body', 'scenario', 'rainfallIncrease'], msg: 'must be 0-500', type: 'value_error' }] }, 422)
    )
    const res = await app.request('/api/simulation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: { rainfallIncrease: 9999 } }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ success: false, error: 'must be 0-500', code: 400, timestamp: expect.any(String) })
  })

  test('unreachable climate -> 502 with the legacy upstream-unavailable shape', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch,
      redis: createFakeRedis(),
      subscriber: createFakeRedis(),
    })
    const res = await app.request('/api/weather')
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body).toEqual({ success: false, error: 'Upstream unavailable', code: 502, timestamp: expect.any(String) })
  })

  test('climate 500 -> 502', async () => {
    const app = appWith(() => jsonResponse({ error: 'boom' }, 500))
    const res = await app.request('/api/heat')
    expect(res.status).toBe(502)
  })
})

describe('CORS', () => {
  test('error responses still carry Access-Control-Allow-Origin', async () => {
    const app = appWith(() => jsonResponse({}))
    const res = await app.request('/nope')
    expect(res.status).toBe(404)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('502 responses carry CORS too', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: (() => Promise.reject(new Error('down'))) as unknown as typeof fetch,
      redis: createFakeRedis(),
      subscriber: createFakeRedis(),
    })
    const res = await app.request('/api/weather')
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  test('OPTIONS preflight -> 204 with CORS headers', async () => {
    const app = appWith(() => jsonResponse({}))
    const res = await app.request('/api/weather', { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
})

describe('/ and /health', () => {
  test('/ reports name/version/status/endpoints', async () => {
    const app = appWith(() => jsonResponse({}))
    const res = await app.request('/')
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.endpoints).toContain('/api/weather')
  })

  test('/health reports status ok', async () => {
    const app = appWith(() => jsonResponse({}))
    const res = await app.request('/health')
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})

describe('alerts + history', () => {
  test('GET /api/alerts -> GET /v1/alerts', async () => {
    const app = appWith((url) => {
      expect(url.pathname).toBe('/v1/alerts')
      return jsonResponse([{ id: 'a1' }])
    })
    const res = await app.request('/api/alerts?lat=10.7&lng=106.7')
    expect(res.status).toBe(200)
  })

  test('POST /api/alerts/read forwards the body to /v1/alerts/read', async () => {
    const app = appWith(async (url, init) => {
      expect(url.pathname).toBe('/v1/alerts/read')
      expect(JSON.parse(String(init?.body))).toEqual({ ids: ['a1', 'a2'] })
      return jsonResponse({ marked: 2 })
    })
    const res = await app.request('/api/alerts/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['a1', 'a2'] }),
    })
    expect(res.status).toBe(200)
  })

  test('GET /api/history/:hazard -> GET /v1/history/:hazard, hours forwarded', async () => {
    const app = appWith((url) => {
      expect(url.pathname).toBe('/v1/history/flood')
      expect(url.searchParams.get('hours')).toBe('24')
      return jsonResponse([])
    })
    const res = await app.request('/api/history/flood?hours=24')
    expect(res.status).toBe(200)
  })
})
