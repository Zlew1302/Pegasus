"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: { value: number; label: string };
  color?: string;
  sparklineData?: number[];
  href?: string;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 64;
  const height = 24;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Resolve CSS variable color to a usable stroke
  const strokeColor = color.includes("var(")
    ? "currentColor"
    : color.startsWith("text-")
      ? "currentColor"
      : color;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={color.startsWith("text-") ? color : ""}
      style={{ opacity: 0.6 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  color = "text-foreground",
  sparklineData,
  href,
}: KpiCardProps) {
  const router = useRouter();

  const handleClick = href
    ? () => router.push(href)
    : undefined;

  return (
    <div
      onClick={handleClick}
      className={`flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4 ${
        href ? "cursor-pointer transition-colors hover:border-[hsl(var(--accent-orange))]/30" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <span className={`text-2xl font-bold ${color}`}>{value}</span>
          {trend && (
            <span
              className={`ml-2 inline-flex items-center gap-0.5 text-xs ${
                trend.value >= 0 ? "text-green-500" : "text-red-400"
              }`}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.label}
            </span>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={color} />
        )}
      </div>
    </div>
  );
}
