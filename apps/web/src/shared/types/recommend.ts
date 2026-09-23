// Field names match RecommendResponse (Hackathon-BE/src/services/recommend.service.ts).
// The recommendation set is RULE-BASED (PDIM Section 4.2(iii)): if/else over
// floodScore/aqi/effTemp thresholds, no AI/LLM call — priorityScore π(r,i) = S(b)·E(i)·F(a)
// is computed with a fixed formula in the backend.
export interface RecommendData {
  recommendations: Recommendation[];
  summary: string;
  overallRiskLevel: "low" | "medium" | "high" | "critical";
}

export interface Recommendation {
  id: string;
  ruleId: string;
  priorityScore: number;
  priority: "low" | "medium" | "high" | "urgent";
  category: "flood" | "air" | "heat" | "combined";
  title: string;
  message: string;
  actionItems: string[];
  timestamp: string;
  inputs?: Record<string, unknown>;
}
