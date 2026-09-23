import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { createFakeClimateFetch, createFakeRedis, jsonResponse } from './fakes.ts'

describe('GET /api/simulation query -> POST /v1/simulation body', () => {
  test('applies the legacy defaults for omitted params', async () => {
    let seenBody: unknown
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(async (url, init) => {
        expect(url.pathname).toBe('/v1/simulation')
        expect(init?.method).toBe('POST')
        seenBody = JSON.parse(String(init?.body))
        return jsonResponse({ deltaT: 0 })
      }),
      redis: createFakeRedis(),
    })

    const res = await app.request('/api/simulation')
    expect(res.status).toBe(200)
    expect(seenBody).toEqual({
      cityId: 'hcmc',
      scenario: {
        rainfallIncrease: 50,
        rainfallDurationHours: 3,
        addGreenCoverage: 0,
        trafficReduction: 0,
        urbanDensity: undefined,
      },
    })
  })

  test('parses provided query params into numbers', async () => {
    let seenBody: unknown
    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(async (_url, init) => {
        seenBody = JSON.parse(String(init?.body))
        return jsonResponse({ deltaT: 0 })
      }),
      redis: createFakeRedis(),
    })

    const res = await app.request(
      '/api/simulation?cityId=hcmc&rainfallIncrease=120&rainfallDurationHours=6&addGreenCoverage=10&trafficReduction=20&urbanDensity=0.6'
    )
    expect(res.status).toBe(200)
    expect(seenBody).toEqual({
      cityId: 'hcmc',
      scenario: {
        rainfallIncrease: 120,
        rainfallDurationHours: 6,
        addGreenCoverage: 10,
        trafficReduction: 20,
        urbanDensity: 0.6,
      },
    })
  })
})
