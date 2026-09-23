import {
  AreaChart as ReAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AreaChartProps {
  data: Record<string, unknown>[];
  areas: Array<{
    dataKey: string;
    color: string;
    name?: string;
    fillOpacity?: number;
  }>;
  xDataKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function AreaChart({
  data,
  areas,
  xDataKey = "name",
  height = 200,
  showGrid = true,
  showLegend = false,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
        <XAxis dataKey={xDataKey} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {areas.map(({ dataKey, color, name, fillOpacity = 0.2 }) => (
          <Area
            key={dataKey}
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={fillOpacity}
            strokeWidth={2}
            dot={false}
            name={name || dataKey}
          />
        ))}
      </ReAreaChart>
    </ResponsiveContainer>
  );
}
