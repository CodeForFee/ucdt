/**
 * The gateway only ever needs this slice of Redis. Bun's real `RedisClient`
 * (from "bun") already implements every one of these methods with matching
 * signatures, so it satisfies this interface structurally — no adapter class
 * needed. Tests inject an in-memory fake instead (see tests/fake-redis.ts).
 */
export interface RedisLike {
  get(key: string): Promise<string | null>
  setex(key: string, seconds: number, value: string): Promise<unknown>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
  ttl(key: string): Promise<number>
  publish(channel: string, message: string): Promise<unknown>
  subscribe(channel: string, listener: (message: string, channel: string) => void): Promise<unknown>
  unsubscribe(channel: string, listener?: (message: string, channel: string) => void): Promise<unknown>
}
