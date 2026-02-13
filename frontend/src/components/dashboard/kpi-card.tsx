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

  const width = 48;
  const height = 20;
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
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={color.startsWith("text-") ? color : ""}
      style={{ opacity: 0.5 }}
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
      className={`flex h-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 ${
        handleClick ? "cursor-pointer transition-colors hover:border-[hsl(var(--accent-orange))]/30" : ""
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-base font-bold leading-none ${color}`}>{value}</span>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] ${
                trend.value >= 0 ? "text-green-500" : "text-red-400"
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
        <p className="text-[10px] leading-tight text-muted-foreground">
          {label}{subtext ? ` · ${subtext}` : ""}
        </p>
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <Sparkline data={sparklineData} color={color} />
      )}
    </div>
  );
}
