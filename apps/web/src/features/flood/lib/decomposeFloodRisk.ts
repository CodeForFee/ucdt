import type { FloodTriggers } from "@/shared/types/flood";

/**
 * Display-only mirror of the published PDIM Stage-1 flood weights (Section 4.2 of the
 * PO-UCDT manuscript; same values as services/climate/climate/pdim/constants.py
 * PDIM_S1.flood — w1..w4, rainRefMmH). This module does not compute the served flood
 * score (DP3: the API's `riskScore`/`overallRisk` are authoritative); it only explains
 * how the score the API already returned decomposes into its four weighted terms, using
 * the raw triggers the API sends. See climate/pdim/flood.py compute_flood's `triggers`
 * comment: "All four R_f terms (B-011) must be reproducible from these."
 */
export const FLOOD_WEIGHTS = {
  w1: 0.45,
  w2: 0.3,
  w3: 0.25,
  w4: 0.15,
  rainRefMmH: 50,
} as const;

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

export interface DecompositionTerm {
  key: "rainfall" | "terrain" | "soil" | "drainage";
  weight: number;
  /** Normalized [0,1] input the weight multiplies. */
  raw: number;
  /** Signed contribution to R_f (drainage is negative — the subtractive term, B-010). */
  contribution: number;
}

export interface Decomposition {
  terms: DecompositionTerm[];
  /** Sum of all four contributions, before the [0,1] clamp the API applies to riskScore. */
  sum: number;
}

/** R_f = w1·P̃ + w2·T̃ + w3·Ĩ − w4·D̃ — pure so it can be unit-tested without rendering. */
export function decomposeFloodRisk(triggers: FloodTriggers): Decomposition {
  const w = FLOOD_WEIGHTS;
  const pTilde = clamp01(triggers.currentRainfall / w.rainRefMmH);
  const tTilde = clamp01(triggers.terrainSensitivity);
  const iTilde = clamp01(triggers.soilSaturation);
  const dTilde = clamp01(triggers.drainageCapacity);

  const terms: DecompositionTerm[] = [
    { key: "rainfall", weight: w.w1, raw: pTilde, contribution: w.w1 * pTilde },
    { key: "terrain", weight: w.w2, raw: tTilde, contribution: w.w2 * tTilde },
    { key: "soil", weight: w.w3, raw: iTilde, contribution: w.w3 * iTilde },
    { key: "drainage", weight: w.w4, raw: dTilde, contribution: -w.w4 * dTilde },
  ];

  return { terms, sum: terms.reduce((s, t) => s + t.contribution, 0) };
}
