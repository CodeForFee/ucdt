import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { createDownRedis, createFakeClimateFetch, createFakeRedis, jsonResponse } from './fakes.ts'

describe('GET+200 cache, keyed by full URL', () => {
  test('MISS then HIT on the same URL, upstream hit only once', async () => {
    let calls = 0
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => {
        calls++
        return jsonResponse({ tempC: 30 })
      }),
      redis: createFakeRedis(),
    })

    const first = await app.request('/api/weather?lat=10.7&lng=106.7')
    expect(first.headers.get('X-Cache')).toBe('MISS')
    expect(await first.json()).toMatchObject({ data: { tempC: 30 } })

    const second = await app.request('/api/weather?lat=10.7&lng=106.7')
    expect(second.headers.get('X-Cache')).toBe('HIT')
    expect(await second.json()).toMatchObject({ data: { tempC: 30 } })

    expect(calls).toBe(1)
  })

  test('a different URL is a separate cache entry (MISS)', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => jsonResponse({ tempC: 30 })),
      redis: createFakeRedis(),
    })
    await app.request('/api/weather?lat=1&lng=1')
    const res = await app.request('/api/weather?lat=2&lng=2')
    expect(res.headers.get('X-Cache')).toBe('MISS')
  })

  test('POST is never cached even on a cached route family', async () => {
    let calls = 0
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => {
        calls++
        return jsonResponse({ ok: true })
      }),
      redis: createFakeRedis(),
    })
    await app.request('/api/simulation', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    await app.request('/api/simulation', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    expect(calls).toBe(2)
  })

  test('redis down -> fails open, still serves 200 without caching', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => jsonResponse({ tempC: 30 })),
      redis: createDownRedis(),
    })
    const res = await app.request('/api/weather')
    expect(res.status).toBe(200)
  })
})
