"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Coins } from "lucide-react";
import { useTokenUsage } from "@/hooks/use-profile";

const COLORS = [
  "hsl(199 89% 48%)",
  "hsl(24 95% 53%)",
  "hsl(142 71% 45%)",
  "hsl(280 67% 55%)",
  "hsl(340 82% 52%)",
];

export function TokenUsageChart() {
  const [groupBy, setGroupBy] = useState<"agent" | "project">("agent");
  const { usage } = useTokenUsage(undefined, undefined, groupBy);

  const chartData = usage.map((u) => ({
    name: u.group_name,
    kosten: u.total_cost_cents / 100,
    tokens_in: u.total_tokens_in,
    tokens_out: u.total_tokens_out,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Token-Nutzung</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setGroupBy("agent")}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              groupBy === "agent"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Nach Agent
          </button>
          <button
            onClick={() => setGroupBy("project")}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              groupBy === "project"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Nach Projekt
          </button>
        </div>
      </div>

      <div className="h-64">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Noch keine Token-Nutzung erfasst
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(216 34% 17%)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(215 16% 57%)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}€`}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(224 71% 4%)",
                  border: "1px solid hsl(216 34% 17%)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: any, name: any) => {
                  const v = Number(value) || 0;
                  if (name === "kosten") return [`${v.toFixed(2)} €`, "Kosten"];
                  return [v.toLocaleString(), name ?? ""];
                }) as any}
              />
              <Bar dataKey="kosten" radius={[4, 4, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
