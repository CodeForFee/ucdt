// @ts-nocheck — a one-shot generator run by tsx, not part of any typechecked package.
/**
 * Golden fixture for the Python PDIM port (T-002): runs the LEGACY TypeScript
 * backend (../Hackathon-BE/src, read-only) on canned inputs and records every
 * output, so `services/climate/tests/pdim` can assert numeric parity.
 *
 *   pnpm parity        → services/climate/tests/fixtures/parity.json
 *
 * Two parts:
 *  - `pure`: grids over the pure functions (riskCalculator, pm25ToAQI, geo, validation).
 *  - `scenarios`: each runs in a FRESH child process (the legacy alerts queue is
 *    module state) with `Date` frozen at `now`, TZ=Asia/Ho_Chi_Minh and `fetch`
 *    mocked with canned Open-Meteo forecast + air-quality payloads. The child
 *    records the transformed WeatherResponse and raw AQ values it fed the models,
 *    so the Python side consumes exactly the same inputs, then every service output.
 *
 * Note B-012: the legacy transform picks the "current hour" by UTC, so `weather`
 * here is what the legacy models actually saw — the Python compute layer takes it
 * as given; the ingest fix is tested separately in T-006.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LEGACY = join(HERE, '..', '..', 'Hackathon-BE', 'src')
const OUT = join(HERE, '..', 'services', 'climate', 'tests', 'fixtures', 'parity.json')
const legacy = (p: string) => import('file:///' + join(LEGACY, p).replace(/\\/g, '/') + '.ts')

// ── Scenarios ────────────────────────────────────────────────────────────────
// weather: the value every hour of the canned day centres on; aq: city PM2.5 in µg/m³.
const SCENARIOS = [
  { id: 'dry-clear-clean',       now: '2026-02-10T03:00:00.000Z', rain: 0,  temp: 30, hum: 60, wind: 8,  code: 0,  pm25: 8 },
  { id: 'rainy-moderate',        now: '2026-08-15T08:00:00.000Z', rain: 12, temp: 31, hum: 82, wind: 15, code: 61, pm25: 30 },
  { id: 'rainy-heavy',           now: '2026-09-23T10:00:00.000Z', rain: 45, temp: 28, hum: 90, wind: 25, code: 65, pm25: 60 },
  { id: 'rainy-extreme',         now: '2026-10-05T12:00:00.000Z', rain: 80, temp: 27, hum: 95, wind: 35, code: 95, pm25: 120 },
  { id: 'dry-heat-polluted',     now: '2026-04-20T06:00:00.000Z', rain: 0,  temp: 38, hum: 55, wind: 5,  code: 1,  pm25: 200 },
  { id: 'hot-humid-unhealthy',   now: '2026-05-12T05:00:00.000Z', rain: 2,  temp: 35, hum: 75, wind: 3,  code: 3,  pm25: 160 },
  { id: 'flood-plus-smog',       now: '2026-10-20T09:00:00.000Z', rain: 60, temp: 29, hum: 88, wind: 12, code: 82, pm25: 80 },
  { id: 'hazardous-air',         now: '2026-01-15T04:00:00.000Z', rain: 0,  temp: 33, hum: 45, wind: 2,  code: 2,  pm25: 400 },
  { id: 'pre-dawn-idx-fallback', now: '2026-09-23T22:30:00.000Z', rain: 20, temp: 26, hum: 92, wind: 10, code: 63, pm25: 25 },
  { id: 'moderate-air',          now: '2026-03-03T02:00:00.000Z', rain: 0,  temp: 29, hum: 55, wind: 6,  code: 2,  pm25: 38 },
  { id: 'all-calm',              now: '2026-12-01T01:00:00.000Z', rain: 0,  temp: 24, hum: 50, wind: 9,  code: 0,  pm25: 4 },
]

const SIMULATIONS = [
  { cityId: 'hcmc', scenario: { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 0 } },
  { cityId: 'hcmc', scenario: { rainfallIncrease: 100, rainfallDurationHours: 3, addGreenCoverage: 10, trafficReduction: 20, urbanDensity: 0.6 } },
  { cityId: 'hcmc', scenario: { rainfallIncrease: 0, rainfallDurationHours: 0, addGreenCoverage: -20, trafficReduction: 0, urbanDensity: 1 } },
  { cityId: 'hcmc', scenario: { rainfallIncrease: 300, rainfallDurationHours: 12, addGreenCoverage: 30, trafficReduction: 60 } },
  { cityId: 'hcmc', scenario: { rainfallIncrease: 0, rainfallDurationHours: 0, addGreenCoverage: 0, trafficReduction: 0 } },
]

// ── Canned provider payloads ─────────────────────────────────────────────────
/** One local day (00:00–23:00 Asia/Ho_Chi_Minh), as Open-Meteo returns for forecast_days=1. */
function forecastPayload(s) {
  const localDay = new Date(Date.parse(s.now) + 7 * 3600_000).toISOString().slice(0, 10)
  const time = [], temperature_2m = [], precipitation = [], windspeed_10m = [], relativehumidity_2m = [], winddirection_10m = []
  for (let h = 0; h < 24; h++) {
    const wave = Math.sin((h / 24) * 2 * Math.PI)
    time.push(`${localDay}T${String(h).padStart(2, '0')}:00`)
    temperature_2m.push(Math.round((s.temp + 3 * wave) * 10) / 10)
    precipitation.push(Math.max(0, Math.round((s.rain * (1 + 0.5 * Math.cos(h))) * 10) / 10))
    windspeed_10m.push(Math.round((s.wind + 4 * Math.abs(wave)) * 10) / 10)
    relativehumidity_2m.push(Math.min(100, Math.round(s.hum - 8 * wave)))
    winddirection_10m.push((200 + h * 7) % 360)
  }
  return {
    current_weather: { temperature: s.temp, windspeed: s.wind, winddirection: 220, weathercode: s.code },
    hourly: { time, temperature_2m, precipitation, windspeed_10m, relativehumidity_2m, winddirection_10m },
  }
}

/** Air-quality payload; PM2.5 varies deterministically with the point so stations differ. */
function airQualityPayload(s, lat: number, lng: number) {
  const k = 1 + (Math.round(lat * 1000 + lng * 1000) % 9) / 20
  return {
    current: {
      pm2_5: Math.round(s.pm25 * k * 10) / 10,
      pm10: Math.round(s.pm25 * 1.6 * k * 10) / 10,
      ozone: Math.round((40 + s.temp) * 10) / 10,
      nitrogen_dioxide: Math.round((10 + s.pm25 / 8) * 10) / 10,
    },
  }
}

// ── Child: one scenario in a fresh process ───────────────────────────────────
async function runChild(scenarioJson: string, outFile: string) {
  const s = JSON.parse(scenarioJson)
  const FIXED = Date.parse(s.now)
  const RealDate = Date
  class FrozenDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(FIXED); else super(...args) }
    static now() { return FIXED }
  }
  globalThis.Date = FrozenDate

  const aqInputs: Record<string, unknown> = {}
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    const ok = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.hostname === 'api.open-meteo.com') return ok(forecastPayload(s))
    if (url.hostname === 'air-quality-api.open-meteo.com') {
      const lat = Number(url.searchParams.get('latitude')), lng = Number(url.searchParams.get('longitude'))
      const body = airQualityPayload(s, lat, lng)
      aqInputs[`${lat},${lng}`] = body.current
      return ok(body)
    }
    return new Response('unmocked', { status: 599 })
  }

  const { DEFAULT_CITY } = await legacy('utils/constants')
  const { lat, lng } = DEFAULT_CITY
  const { getWeather } = await legacy('services/weather.service')
  const { getFloodRisk } = await legacy('services/flood.service')
  const { getHeatData } = await legacy('services/heat.service')
  const { getAQI } = await legacy('services/aqi.service')
  const { getRecommendations } = await legacy('services/recommend.service')
  const { getAlerts } = await legacy('services/alerts.service')
  const { runSimulation } = await legacy('services/simulation.service')

  const result = {
    id: s.id,
    now: s.now,
    month: new Date().getMonth() + 1, // HCMC-local month (TZ is set by the parent)
    inputs: {
      openMeteoForecast: forecastPayload(s),
      weather: await getWeather(lat, lng),
      airQuality: null as unknown,
    },
    outputs: {
      flood: await getFloodRisk(lat, lng),
      heat: await getHeatData(lat, lng),
      aqi: await getAQI(lat, lng),
      recommend: await getRecommendations(lat, lng),
      alertsFirstCall: await getAlerts(lat, lng),
      simulations: [] as unknown[],
    },
  }
  for (const req of SIMULATIONS) {
    result.outputs.simulations.push({ request: req, result: await runSimulation(req) })
  }
  result.inputs.airQuality = aqInputs
  writeFileSync(outFile, JSON.stringify(result))
}

// ── Parent: pure grids + fan out scenarios ───────────────────────────────────
async function runParent() {
  const rc = await legacy('utils/riskCalculator')
  const dt = await legacy('utils/dataTransformer')
  const geo = await legacy('utils/geoUtils')
  const c = await legacy('utils/constants')
  const { validateScenario } = await legacy('controllers/simulation.controller')

  const floodRiskScore = []
  for (const rain of [0, 5, 12.5, 25, 49.9, 50, 75])
    for (const soil of [-0.2, 0, 0.3, 0.65, 1, 1.4])
      for (const drain of [0, 0.45, 1])
        for (const terrain of [undefined, 0.6, 1]) {
          const args = terrain === undefined ? [rain, soil, drain] : [rain, soil, drain, terrain]
          floodRiskScore.push({ args, out: rc.floodRiskScore(...args) })
        }

  const scores = [0, 0.1, 0.2499, 0.25, 0.4999, 0.5, 0.7499, 0.75, 0.9, 1]
  const heatIndex = [], effectiveTemp = []
  for (let t = 20; t <= 45; t += 2.5)
    for (let h = 5; h <= 100; h += 15) {
      heatIndex.push({ args: [t, h], out: rc.heatIndex(t, h) })
      effectiveTemp.push({ args: [t, h, 0.8], out: rc.effectiveTemp(t, h, 0.8) })
    }
  // Rothfusz adjustment branches: dry (RH<13, 80–112 °F) and humid (RH>85, 80–87 °F)
  for (const [t, h] of [[30, 10], [40, 8], [28, 90], [30, 95]]) heatIndex.push({ args: [t, h], out: rc.heatIndex(t, h) })

  const aqiNowcastStep = []
  for (const aqi of [0, 42, 100, 180, 350])
    for (const wind of [0, 10, 30, 60])
      for (const rain of [0, 10, 50, 90]) aqiNowcastStep.push({ args: [aqi, wind, rain], out: rc.aqiNowcastStep(aqi, wind, rain) })

  const pm25 = [0, 5, 12, 12.04, 12.05, 12.1, 20, 35.4, 35.45, 35.5, 55.4, 100, 150.4, 150.5, 250.4, 250.5, 350.4, 350.5, 500.4, 500.5, 600]
  const aqis = [0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301, 500, 501]

  const validation = [
    { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 0 },
    { rainfallIncrease: -1, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 0 },
    { rainfallIncrease: 501, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 0 },
    { rainfallIncrease: 50, rainfallDurationHours: 73, addGreenCoverage: 0, trafficReduction: 0 },
    { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: 101, trafficReduction: 0 },
    { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: -101, trafficReduction: 0 },
    { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 101 },
    { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 0, urbanDensity: 1.1 },
    { rainfallIncrease: 50, rainfallDurationHours: 3, addGreenCoverage: 0, trafficReduction: 0, urbanDensity: 0 },
  ].map((s) => ({ scenario: s, out: validateScenario(s) }))

  const pure = {
    floodRiskScore,
    floodRiskLevel: scores.map((s) => ({ args: [s], out: rc.floodRiskLevel(s) })),
    estimatedDepthM: scores.map((s) => ({ args: [s], out: rc.estimatedDepthM(s) })),
    heatIndex,
    effectiveTemp,
    aqiNowcastStep,
    pm25ToAQI: pm25.map((v) => ({ args: [v], out: dt.pm25ToAQI(v) })),
    aqiLevel: aqis.map((v) => ({ args: [v], out: rc.aqiLevel(v) })),
    aqiCategory: aqis.map((v) => ({ args: [v], out: c.getAQICategory(v) })),
    generateFloodPolygon: [[10.7285, 106.6785, 1.2, 0.3], [10.905, 106.62, 1.2, 0.81], [10.412, 106.952, 1.2, 0]].map((args) => ({
      args,
      out: geo.generateFloodPolygon(...args),
    })),
    validateScenario: validation,
  }

  const tmp = mkdtempSync(join(tmpdir(), 'ucdt-parity-'))
  const scenarios = []
  for (const s of SCENARIOS) {
    const out = join(tmp, `${s.id}.json`)
    const r = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), '--child', JSON.stringify(s), out], {
      env: { ...process.env, TZ: 'Asia/Ho_Chi_Minh' },
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    if (r.status !== 0) throw new Error(`scenario ${s.id} failed with status ${r.status}`)
    scenarios.push(JSON.parse(readFileSync(out, 'utf8')))
  }

  const fixture = {
    generatedBy: 'ucdt/tools/gen-parity.ts from Hackathon-BE (legacy, read-only)',
    note: 'Numbers must match to 1e-9. simulationId and alert ids are counters/timestamps — compare by shape, not value.',
    constants: { PDIM_S1: c.PDIM_S1, RISK_THRESHOLDS: c.RISK_THRESHOLDS, AQI_CATEGORIES: c.AQI_CATEGORIES, DRY_DAY_REFERENCE_RAIN_MM_H: c.DRY_DAY_REFERENCE_RAIN_MM_H, DEFAULT_CITY: c.DEFAULT_CITY },
    simulations: SIMULATIONS,
    pure,
    scenarios,
  }
  writeFileSync(OUT, JSON.stringify(fixture) + '\n')
  console.log(`parity: ${Object.values(pure).reduce((n, g) => n + g.length, 0)} pure cases, ${scenarios.length} scenarios → ${OUT}`)
}

const i = process.argv.indexOf('--child')
if (i >= 0) await runChild(process.argv[i + 1], process.argv[i + 2])
else await runParent()
