"use client";

import { useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import { Pencil, Check, X, Bot, Zap, Coins, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useCosts, useAgentCosts } from "@/hooks/use-dashboard";
import type { KeyedMutator } from "swr";
import type { Project } from "@/types";

interface ProjectBudgetTabProps {
  projectId: string;
  budgetCents: number;
  onBudgetUpdated?: () => void;
  mutateProject?: KeyedMutator<Project>;
}

const PIE_COLORS = [
  "hsl(24 95% 53%)",   // orange
  "hsl(199 89% 48%)",  // cyan
  "hsl(262 83% 58%)",  // purple
  "hsl(142 71% 45%)",  // green
  "hsl(348 83% 47%)",  // red
  "hsl(43 96% 56%)",   // amber
  "hsl(210 40% 52%)",  // steel
  "hsl(330 65% 55%)",  // pink
];

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function ProjectBudgetTab({
  projectId,
  budgetCents,
  onBudgetUpdated,
  mutateProject,
}: ProjectBudgetTabProps) {
  const { costs } = useCosts(undefined, undefined, projectId);
  const { agentCosts, isLoading: agentCostsLoading } = useAgentCosts(projectId);

  // Editable budget state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Computed values from real data
  const totalSpent = costs.reduce((sum, c) => sum + c.cost_cents, 0);
  const budgetEuro = budgetCents / 100;
  const spentEuro = totalSpent / 100;
  const remaining = budgetCents - totalSpent;
  const consumptionPercent = budgetCents > 0 ? (totalSpent / budgetCents) * 100 : 0;

  // Chart data from real costs
  const chartData = costs.map((c) => ({
    date: c.date,
    kosten: c.cost_cents / 100,
  }));

  // Budget limit line value in Euro for chart
  const budgetLineEuro = budgetCents > 0 ? budgetEuro : undefined;

  // Pie chart data from real agent costs
  const pieData = agentCosts
    .filter((a) => a.total_cost_cents > 0)
    .map((a) => ({
      name: a.agent_type_name,
      value: a.total_cost_cents,
    }));

  const handleStartEdit = useCallback(() => {
    setEditValue((budgetCents / 100).toFixed(2));
    setIsEditing(true);
  }, [budgetCents]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue("");
  }, []);

  const handleSaveBudget = useCallback(async () => {
    const euroValue = parseFloat(editValue.replace(",", "."));
    if (isNaN(euroValue) || euroValue < 0) return;

    const newBudgetCents = Math.round(euroValue * 100);
    setIsSaving(true);
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ budget_cents: newBudgetCents }),
      });
      setIsEditing(false);
      setEditValue("");
      if (mutateProject) await mutateProject();
      if (onBudgetUpdated) onBudgetUpdated();
    } catch {
      // Error handled silently - user can retry
    } finally {
      setIsSaving(false);
    }
  }, [editValue, projectId, mutateProject, onBudgetUpdated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSaveBudget();
      if (e.key === "Escape") handleCancelEdit();
    },
    [handleSaveBudget, handleCancelEdit]
  );

  return (
    <div className="space-y-6 p-4">
      {/* ── Section 1: Budget Header ────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Budget (editable) */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Budget</span>
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Budget bearbeiten"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded border border-border bg-background px-2 py-1 text-lg font-bold text-foreground outline-none focus:border-[hsl(var(--accent-orange))]"
                autoFocus
                disabled={isSaving}
                placeholder="0.00"
              />
              <span className="text-lg font-bold text-muted-foreground">€</span>
              <button
                onClick={handleSaveBudget}
                disabled={isSaving}
                className="rounded p-1 text-green-500 transition-colors hover:bg-green-500/10"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-1 text-xl font-bold">
              {budgetCents > 0 ? `${formatEuro(budgetCents)} €` : "Nicht festgelegt"}
            </p>
          )}
        </div>

        {/* Ausgegeben */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <Coins className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Ausgegeben</span>
          </div>
          <p className="mt-1 text-xl font-bold text-[hsl(var(--accent-orange))]">
            {formatEuro(totalSpent)} €
          </p>
        </div>

        {/* Verbleibend */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Verbleibend</span>
          </div>
          <p
            className={`mt-1 text-xl font-bold ${
              budgetCents === 0
                ? "text-muted-foreground"
                : remaining < 0
                  ? "text-destructive"
                  : "text-green-500"
            }`}
          >
            {budgetCents > 0 ? `${formatEuro(remaining)} €` : "–"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {budgetCents > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Verbrauch</span>
            <span>{Math.min(consumptionPercent, 999).toFixed(1)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                consumptionPercent > 90
                  ? "bg-destructive"
                  : consumptionPercent > 70
                    ? "bg-yellow-500"
                    : "bg-[hsl(var(--accent-orange))]"
              }`}
              style={{
                width: `${Math.min(100, consumptionPercent)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Section 2: Kostenverlauf Chart ──────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Kostenverlauf</h3>
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
                  tickFormatter={(v: number) => `${v.toFixed(2)}€`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(224 71% 4%)",
                    border: "1px solid hsl(216 34% 17%)",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(2)} €`, "Kosten"]}
                  labelFormatter={(label: unknown) => `Datum: ${label}`}
                />
                {budgetLineEuro !== undefined && (
                  <ReferenceLine
                    y={budgetLineEuro}
                    stroke="hsl(348 83% 47%)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Budget: ${formatEuro(budgetCents)} €`,
                      position: "insideTopRight",
                      fill: "hsl(348 83% 47%)",
                      fontSize: 10,
                    }}
                  />
                )}
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

      {/* ── Section 3: Kosten nach Agent-Typ ────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Kosten nach Agent-Typ</h3>
        {agentCostsLoading ? (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">Lade Agent-Kosten...</p>
          </div>
        ) : agentCosts.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <div className="text-center">
              <Bot className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Noch keine Agent-Aktivität in diesem Projekt
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {agentCosts.map((agent, idx) => (
              <div
                key={agent.agent_type_name}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <div>
                    <p className="text-sm font-medium">{agent.agent_type_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.instance_count} {agent.instance_count === 1 ? "Ausführung" : "Ausführungen"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Tokens</p>
                    <p className="text-xs font-medium">
                      <Zap className="mr-0.5 inline h-3 w-3 text-yellow-500" />
                      {formatTokens(agent.total_tokens_in + agent.total_tokens_out)}
                    </p>
                  </div>
                  <div className="min-w-[80px]">
                    <p className="text-xs text-muted-foreground">Kosten</p>
                    <p className="text-sm font-bold text-[hsl(var(--accent-orange))]">
                      {formatEuro(agent.total_cost_cents)} €
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Kostenverteilung (Pie Chart) ─────────── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Kostenverteilung</h3>
        {pieData.length === 0 ? (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Keine Kostendaten zum Visualisieren vorhanden
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <div className="h-48 w-48 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(224 71% 4%)",
                      border: "1px solid hsl(216 34% 17%)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                    formatter={(value: number | undefined) => [`${formatEuro(value ?? 0)} €`, "Kosten"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {pieData.map((entry, idx) => {
                const totalPieCost = pieData.reduce((s, e) => s + e.value, 0);
                const pct = totalPieCost > 0 ? ((entry.value / totalPieCost) * 100).toFixed(1) : "0";
                return (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <span className="font-medium">
                      {formatEuro(entry.value)} € ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
