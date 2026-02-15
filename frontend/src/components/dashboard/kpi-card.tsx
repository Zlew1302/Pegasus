"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  subtext?: string;
  trend?: { value: number; label: string };
  color?: string;
  sparklineData?: number[];
  href?: string;
  onClick?: () => void;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 100;
  const height = 24;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor = color.includes("var(")
    ? "currentColor"
    : color.startsWith("text-")
      ? "currentColor"
      : color;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={color.startsWith("text-") ? color : ""}
      style={{ opacity: 0.4 }}
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
  subtext,
  trend,
  color = "text-foreground",
  sparklineData,
  href,
  onClick,
}: KpiCardProps) {
  const router = useRouter();

  const handleClick = onClick
    ? onClick
    : href
      ? () => router.push(href)
      : undefined;

  return (
    <div
      onClick={handleClick}
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-lg border border-border bg-card px-3.5 py-3 transition-all duration-200 hover:border-[hsl(var(--accent-orange))]/30 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 ${
        handleClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Top: Icon + Trend */}
      <div className="flex items-center justify-between">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/60`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              trend.value >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-400"
            }`}
          >
            {trend.value >= 0 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            {trend.label}
          </span>
        )}
      </div>

      {/* Middle: Value */}
      <div className="mt-2">
        <span className={`text-2xl font-bold leading-none tracking-tight ${color}`}>{value}</span>
        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
          {label}{subtext ? ` · ${subtext}` : ""}
        </p>
      </div>

      {/* Bottom: Sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-2">
          <Sparkline data={sparklineData} color={color} />
        </div>
      )}
    </div>
  );
}
