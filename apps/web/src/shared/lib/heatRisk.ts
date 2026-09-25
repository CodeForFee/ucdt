import type { RiskLevel } from "@/shared/constants/riskLevels";

/**
 * T_eff (°C) -> risk band, shared by HeatSidebar's preview and the Heat risk page. Heat has
 * no server-served band the way flood/AQI do (FloodArea.riskLevel, AQI categories) — these
 * thresholds mirror the ones HeatSidebar already used before this was extracted.
 */
export function heatRiskLevel(effectiveTempC: number): RiskLevel {
  if (effectiveTempC >= 44) return "critical";
  if (effectiveTempC >= 40) return "high";
  if (effectiveTempC >= 37) return "medium";
  return "low";
}
