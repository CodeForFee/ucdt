export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Presentation attributes for the four PDIM decision bands. Labels come from i18n
 * (`risk.*`), not from here.
 *
 * DP3: the web never computes a PDIM score->band mapping (that lived in
 * Hackathon-FE's shared/lib/pdim.ts, deliberately not ported — see T-005's Handoff).
 * Every risk level the UI shows must come from the API response as a string
 * (`FloodArea.riskLevel`, `RecommendData.overallRiskLevel`, ...), never be computed
 * client-side from a raw score.
 */
export const RISK_LEVELS: Record<
  RiskLevel,
  {
    color: string;
    bgColor: string;
    textColor: string;
  }
> = {
  low: { color: "#22c55e", bgColor: "bg-green-500/20", textColor: "text-green-400" },
  medium: { color: "#eab308", bgColor: "bg-yellow-500/20", textColor: "text-yellow-400" },
  high: { color: "#f97316", bgColor: "bg-orange-500/20", textColor: "text-orange-400" },
  critical: { color: "#ef4444", bgColor: "bg-red-500/20", textColor: "text-red-400" },
};
