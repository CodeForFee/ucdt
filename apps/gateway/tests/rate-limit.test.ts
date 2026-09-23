import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { createDownRedis, createFakeClimateFetch, createFakeRedis, jsonResponse } from './fakes.ts'

describe('rate limit: 100 req/min per IP', () => {
  test('429 on the 101st request from the same IP, 200 for the first 100', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => jsonResponse({ ok: true })),
      redis: createFakeRedis(),
    })

    const req = () => app.request('/api/weather', { headers: { 'x-forwarded-for': '1.2.3.4' } })

    let last!: Response
    for (let i = 0; i < 100; i++) {
      last = await req()
    }
    expect(last.status).toBe(200)
    expect(last.headers.get('X-RateLimit-Remaining')).toBe('0')

    const res101 = await req()
    expect(res101.status).toBe(429)
    const body = await res101.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Too Many Requests')
  })

  test('a different IP is not throttled by the first IP', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => jsonResponse({ ok: true })),
      redis: createFakeRedis(),
    })
    for (let i = 0; i < 100; i++) {
      await app.request('/api/weather', { headers: { 'x-forwarded-for': '9.9.9.9' } })
    }
    const res = await app.request('/api/weather', { headers: { 'x-forwarded-for': '8.8.8.8' } })
    expect(res.status).toBe(200)
  })

  test('redis down -> fails open, no limiting', async () => {
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => jsonResponse({ ok: true })),
      redis: createDownRedis(),
    })
    const res = await app.request('/api/weather')
    expect(res.status).toBe(200)
  })
})
