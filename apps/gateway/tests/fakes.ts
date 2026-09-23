import type { RedisLike } from '../src/redis.ts'

interface Entry {
  value: string
  expiresAt: number | null
}

/** In-memory stand-in for Bun's RedisClient, scoped to what the gateway uses. */
export function createFakeRedis(): RedisLike {
  const store = new Map<string, Entry>()
  const subs = new Map<string, Set<(message: string, channel: string) => void>>()

  const live = (key: string): Entry | undefined => {
    const e = store.get(key)
    if (!e) return undefined
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      store.delete(key)
      return undefined
    }
    return e
  }

  return {
    async get(key) {
      return live(key)?.value ?? null
    },
    async setex(key, seconds, value) {
      store.set(key, { value, expiresAt: Date.now() + seconds * 1000 })
    },
    async incr(key) {
      const e = live(key)
      const next = (e ? Number.parseInt(e.value, 10) : 0) + 1
      store.set(key, { value: String(next), expiresAt: e ? e.expiresAt : null })
      return next
    },
    async expire(key, seconds) {
      const e = store.get(key)
      if (e) e.expiresAt = Date.now() + seconds * 1000
    },
    async ttl(key) {
      const e = live(key)
      if (!e || e.expiresAt === null) return -1
      return Math.ceil((e.expiresAt - Date.now()) / 1000)
    },
    async publish(channel, message) {
      const listeners = subs.get(channel)
      if (!listeners) return 0
      for (const listener of listeners) listener(message, channel)
      return listeners.size
    },
    async subscribe(channel, listener) {
      if (!subs.has(channel)) subs.set(channel, new Set())
      subs.get(channel)?.add(listener)
    },
    async unsubscribe(channel, listener) {
      const listeners = subs.get(channel)
      if (!listeners) return
      if (listener) listeners.delete(listener)
      else subs.delete(channel)
    },
  }
}

/** A redis that fails every call — proves middleware fails OPEN. */
export function createDownRedis(): RedisLike {
  const fail = () => Promise.reject(new Error('redis unavailable (fake)'))
  return {
    get: fail,
    setex: fail,
    incr: fail,
    expire: fail,
    ttl: fail,
    publish: fail,
    subscribe: fail,
    unsubscribe: fail,
  }
}

/** A `fetch` that answers from a handler instead of a real socket. */
export function createFakeClimateFetch(
  handler: (url: URL, init: RequestInit | undefined) => Response | Promise<Response>
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    return handler(url, init)
  }) as typeof fetch
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
