import type { Context } from 'hono'

export interface ClimateDeps {
  /** Base URL of the internal climate service, e.g. http://localhost:8000 */
  climateUrl: string
  /** Injectable so tests can point at a fake server without a real socket. */
  climateFetch: typeof fetch
}

function errorBody(error: string, code: number) {
  return { success: false, error, code, timestamp: new Date().toISOString() }
}

function notFoundBody(path: string) {
  return { success: false, error: 'Not found', path, timestamp: new Date().toISOString() }
}

/** Wraps a bare climate JSON body in the legacy `{success,data,timestamp,cached}` envelope. */
function envelope(data: unknown) {
  return { success: true, data, timestamp: new Date().toISOString(), cached: false }
}

/**
 * FastAPI's 422 validation body is `{"detail": [{"loc","msg","type"}, ...]}`
 * (or occasionally `{"detail": "message"}`). Reduce it to one string for the
 * legacy `error` field.
 */
function extractValidationMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) {
      const msgs = detail.map((e) =>
        e && typeof e === 'object' && 'msg' in e ? String((e as { msg: unknown }).msg) : String(e)
      )
      return msgs.join('; ')
    }
  }
  return 'Validation failed'
}

/**
 * Forward a request to the climate service and translate its bare JSON
 * response into the legacy envelope / error shapes. This is the ONLY place
 * that talks to `CLIMATE_URL` — the gateway never computes a domain value
 * itself, it only reshapes what climate returns.
 */
export async function forward(
  c: Context,
  deps: ClimateDeps,
  method: 'GET' | 'POST',
  path: string,
  opts: { query?: string; body?: unknown } = {}
): Promise<Response> {
  const url = `${deps.climateUrl}${path}${opts.query ? `?${opts.query}` : ''}`
  const hasBody = opts.body !== undefined

  let res: Response
  try {
    res = await deps.climateFetch(url, {
      method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(opts.body) : undefined,
    })
  } catch (err) {
    console.error('[gateway] climate unreachable:', err)
    return c.json(errorBody('Upstream unavailable', 502), 502)
  }

  if (res.status === 404) {
    return c.json(notFoundBody(c.req.path), 404)
  }

  if (res.status === 422) {
    const body = await res.json().catch(() => null)
    return c.json(errorBody(extractValidationMessage(body), 400), 400)
  }

  if (!res.ok) {
    // Any other non-2xx (5xx, or an undocumented status) — climate misbehaving
    // counts as unavailable rather than inventing a new public error shape.
    console.error(`[gateway] climate returned ${res.status} for ${url}`)
    return c.json(errorBody('Upstream unavailable', 502), 502)
  }

  const data = await res.json().catch(() => null)
  return c.json(envelope(data))
}

/** Full query string of the incoming request, `?a=b` or `''` — forwarded as-is. */
export function queryString(c: Context): string {
  return new URL(c.req.url).search.replace(/^\?/, '')
}
