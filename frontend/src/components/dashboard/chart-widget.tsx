"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";

interface ChartWidgetProps {
  title: string;
  data: { date: string; value: number }[];
  color?: string;
  valueLabel?: string;
  formatValue?: (v: number) => string;
  /** When inside WidgetWrapper, don't render own border/title */
  embedded?: boolean;
}

const RANGES = [
  { key: "week", label: "7T" },
  { key: "month", label: "30T" },
  { key: "quarter", label: "90T" },
] as const;

export function ChartWidget({
  title,
  data,
  color = "hsl(199 89% 48%)",
  valueLabel = "Wert",
  formatValue = (v) => String(v),
  embedded = false,
}: ChartWidgetProps) {
  const [range, setRange] = useState<string>("month");
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  // Filter data by range
  const now = new Date();
  const days = range === "week" ? 7 : range === "quarter" ? 90 : 30;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const filtered = data.filter((d) => d.date >= cutoff);

  const controls = (
    <div className="flex items-center gap-2">
      {/* Chart type toggle */}
      <div className="flex gap-0.5 rounded-md bg-secondary/50 p-0.5">
        <button
          onClick={() => setChartType("area")}
          className={`rounded p-1 transition-colors ${
            chartType === "area"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Fläche"
        >
          <TrendingUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => setChartType("bar")}
          className={`rounded p-1 transition-colors ${
            chartType === "bar"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Balken"
        >
          <BarChart3 className="h-3 w-3" />
        </button>
      </div>
      {/* Range buttons */}
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              range === r.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      {chartType === "area" ? (
        <AreaChart data={filtered}>
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(216 34% 17%)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()}.${d.getMonth() + 1}`;
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(224 71% 4%)",
              border: "1px solid hsl(216 34% 17%)",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined) => [
              formatValue(value ?? 0),
              valueLabel,
            ]}
            labelFormatter={(label) => {
              const d = new Date(label);
              return d.toLocaleDateString("de-DE");
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${title})`}
          />
        </AreaChart>
      ) : (
        <BarChart data={filtered}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(216 34% 17%)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()}.${d.getMonth() + 1}`;
            }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(224 71% 4%)",
              border: "1px solid hsl(216 34% 17%)",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined) => [
              formatValue(value ?? 0),
              valueLabel,
            ]}
            labelFormatter={(label) => {
              const d = new Date(label);
              return d.toLocaleDateString("de-DE");
            }}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[2, 2, 0, 0]}
            opacity={0.8}
          />
        </BarChart>
      )}
    </ResponsiveContainer>
  );

  if (embedded) {
    // Inside WidgetWrapper — no own border/title, just controls + chart
    return (
      <div className="flex h-full flex-col">
        <div className="mb-2 flex justify-end">{controls}</div>
        <div className="flex-1">{chart}</div>
      </div>
    );
  }

  // Standalone mode (backwards compat)
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {controls}
      </div>
      <div className="flex-1">{chart}</div>
    </div>
  );
}
