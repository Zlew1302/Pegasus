"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCosts } from "@/hooks/use-dashboard";

interface ProjectBudgetTabProps {
  projectId: string;
  budgetCents: number;
}

export function ProjectBudgetTab({ projectId, budgetCents }: ProjectBudgetTabProps) {
  const { costs } = useCosts(undefined, undefined, projectId);

  const chartData = costs.map((c) => ({
    date: c.date,
    kosten: c.cost_cents / 100,
  }));

  const totalSpent = costs.reduce((sum, c) => sum + c.cost_cents, 0);
  const budgetEuro = budgetCents / 100;
  const spentEuro = totalSpent / 100;
  const remaining = budgetEuro - spentEuro;

  return (
    <div className="space-y-6 p-4">
      {/* Budget Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Budget</span>
          <p className="text-xl font-bold">
            {budgetCents > 0 ? `${budgetEuro.toFixed(2)} €` : "–"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Ausgegeben</span>
          <p className="text-xl font-bold text-[hsl(var(--accent-orange))]">
            {spentEuro.toFixed(2)} {"€"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">Verbleibend</span>
          <p
            className={`text-xl font-bold ${
              remaining < 0 ? "text-destructive" : "text-green-500"
            }`}
          >
            {budgetCents > 0 ? `${remaining.toFixed(2)} €` : "–"}
          </p>
        </div>
      </div>

      {/* Budget bar */}
      {budgetCents > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Verbrauch</span>
            <span>
              {((spentEuro / budgetEuro) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${
                spentEuro / budgetEuro > 0.8
                  ? "bg-destructive"
                  : "bg-[hsl(var(--accent-orange))]"
              }`}
              style={{
                width: `${Math.min(100, (spentEuro / budgetEuro) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Cost Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Token-Kosten Verlauf</h3>
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">
                Noch keine Kosten für dieses Projekt
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="budgetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24 95% 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(24 95% 53%)" stopOpacity={0} />
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
                />
                <Area
                  type="monotone"
                  dataKey="kosten"
                  stroke="hsl(24 95% 53%)"
                  strokeWidth={2}
                  fill="url(#budgetGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
