import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
}

export function KpiCard({ label, value, hint, icon, trend, highlight }: KpiCardProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-xl p-5 transition-all hover:scale-[1.02] hover:glow-gold",
        highlight && "glow-gold",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
          {label}
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[oklch(0.83_0.16_88_/_0.12)] flex items-center justify-center text-[oklch(0.83_0.16_88)]">
            {icon}
          </div>
        )}
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold gold-text leading-none">
        {value}
      </div>
      {hint && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {trend === "up" && <TrendingUp className="w-3 h-3 text-[oklch(0.72_0.18_150)]" />}
          {trend === "down" && <TrendingDown className="w-3 h-3 text-[oklch(0.65_0.22_25)]" />}
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}
