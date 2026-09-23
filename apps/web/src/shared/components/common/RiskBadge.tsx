import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/shared/constants/riskLevels";
import { useTranslations } from "use-intl";

interface RiskBadgeProps {
  level: RiskLevel;
  showViLabel?: boolean;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  const r = useTranslations("risk");

  const LABELS: Record<RiskLevel, string> = {
    low: r("low"),
    medium: r("medium"),
    high: r("high"),
    critical: r("critical"),
  };

  const variantStyles: Record<RiskLevel, string> = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return <Badge className={`${variantStyles[level]} font-medium border`}>{LABELS[level]}</Badge>;
}
