import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BarChartProps {
  data: Record<string, unknown>[];
  bars: Array<{
    dataKey: string;
    color: string;
    name?: string;
    radius?: number;
  }>;
  xDataKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
}

export function BarChart({
  data,
  bars,
  xDataKey = "name",
  height = 200,
  showGrid = true,
  showLegend = false,
  stacked = false,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
        <XAxis dataKey={xDataKey} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map(({ dataKey, color, name, radius = 3 }) => (
          <Bar
            key={dataKey}
            dataKey={dataKey}
            fill={color}
            name={name || dataKey}
            radius={[radius, radius, 0, 0]}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </ReBarChart>
    </ResponsiveContainer>
  );
}
