import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app.ts'
import { createFakeClimateFetch, createFakeRedis, jsonResponse } from './fakes.ts'

describe('GET /api/stream (SSE from ucdt:events)', () => {
  test('delivers a published event to a connected client', async () => {
    const redis = createFakeRedis()

    // Synchronize with the handler's async subscribe() so publish() below
    // isn't racing against listener registration.
    let markSubscribed: () => void = () => {}
    const subscribed = new Promise<void>((resolve) => {
      markSubscribed = resolve
    })
    const originalSubscribe = redis.subscribe.bind(redis)
    redis.subscribe = async (channel, listener) => {
      const result = await originalSubscribe(channel, listener)
      markSubscribed()
      return result
    }

    const app = createApp({
      climateUrl: 'http://climate.internal',
      climateFetch: createFakeClimateFetch(() => jsonResponse({})),
      redis,
    })

    const res = await app.request('/api/stream')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/event-stream')

    await subscribed
    await redis.publish('ucdt:events', JSON.stringify({ type: 'flood-alert', zone: 'gz-q8-rach-ong' }))

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    const deadline = Date.now() + 2000
    while (!text.includes('flood-alert') && Date.now() < deadline) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) text += decoder.decode(value)
    }
    await reader.cancel()

    expect(text).toContain('event: flood-alert')
    expect(text).toContain('data: {"type":"flood-alert","zone":"gz-q8-rach-ong"}')
  })
})
