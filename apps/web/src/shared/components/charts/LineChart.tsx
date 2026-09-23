import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface LineChartProps {
  data: Record<string, unknown>[];
  lines: Array<{
    dataKey: string;
    color: string;
    name?: string;
    strokeWidth?: number;
  }>;
  xDataKey?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
}

export function LineChart({
  data,
  lines,
  xDataKey = "name",
  height = 200,
  showGrid = true,
  showLegend = false,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />}
        <XAxis dataKey={xDataKey} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
          labelStyle={{ color: "#e4e4e7", fontSize: 12 }}
          itemStyle={{ fontSize: 12 }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map(({ dataKey, color, name, strokeWidth = 2 }) => (
          <Line
            key={dataKey}
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            name={name || dataKey}
          />
        ))}
      </ReLineChart>
    </ResponsiveContainer>
  );
}
