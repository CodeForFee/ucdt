import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendIndicatorProps {
  value: number;
  unit?: string;
  reverseColors?: boolean;
}

export function TrendIndicator({ value, unit = "%", reverseColors = false }: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  const getColor = () => {
    if (isNeutral) return "text-muted-foreground";
    if (reverseColors) {
      return isPositive ? "text-red-400" : "text-green-400";
    }
    return isPositive ? "text-green-400" : "text-red-400";
  };

  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${getColor()}`}>
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isNeutral ? "0" : `${Math.abs(value).toFixed(1)}`}
      {unit}
    </span>
  );
}
