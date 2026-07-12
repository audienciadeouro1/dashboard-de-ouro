import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CanonicalKey } from "@/lib/csv/normalize";
import { cn } from "@/lib/utils";
import { METRIC_CONFIGS } from "./metric-configs";

export function Highlight({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  accent?: "success" | "warning";
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-[oklch(0.83_0.16_88_/_0.1)] last:border-0 last:pb-0">
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          accent === "success" && "bg-[oklch(0.72_0.18_150_/_0.15)] text-[oklch(0.78_0.18_150)]",
          accent === "warning" && "bg-[oklch(0.78_0.16_60_/_0.15)] text-[oklch(0.85_0.16_60)]",
          !accent && "bg-[oklch(0.83_0.16_88_/_0.12)] text-[oklch(0.83_0.16_88)]",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value || "—"}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sub}</div>}
      </div>
    </div>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-[oklch(0.83_0.16_88_/_0.15)] rounded-lg">
      {label}
    </div>
  );
}

export function MetricSelector({
  available,
  onSelect,
}: {
  available: CanonicalKey[];
  onSelect: (m: CanonicalKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-full min-h-[100px] border-2 border-dashed border-[oklch(0.83_0.16_88_/_0.2)] hover:border-[oklch(0.83_0.16_88_/_0.5)] rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-[oklch(0.83_0.16_88)] transition-all group no-print">
          <PlusCircle className="w-6 h-6 opacity-50 group-hover:opacity-100" />
          <span className="text-xs font-medium uppercase tracking-wider">Adicionar métrica</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2 bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] shadow-2xl">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider border-b border-[oklch(0.83_0.16_88_/_0.1)] mb-1">
          Escolha uma métrica
        </div>
        <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
          {available.map((m) => {
            const conf = METRIC_CONFIGS[m];
            if (!conf) return null;
            return (
              <button
                key={m}
                onClick={() => {
                  onSelect(m);
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[oklch(0.83_0.16_88_/_0.15)] rounded-lg transition-all text-left w-full group"
              >
                <div className="w-8 h-8 rounded-md bg-[oklch(0.16_0_0)] flex items-center justify-center text-[oklch(0.83_0.16_88)] group-hover:scale-110 transition-transform">
                  {conf.icon}
                </div>
                <span className="text-sm font-medium group-hover:text-white transition-colors">
                  {conf.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function RankRow({
  rank,
  name,
  value,
  sub,
  positive,
}: {
  rank: number;
  name: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[oklch(0.83_0.16_88_/_0.05)]">
      <div
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0",
          positive ? "gold-gradient text-black" : "bg-[oklch(0.22_0_0)] text-muted-foreground",
        )}
      >
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function DxList({
  title,
  items,
  icon,
  color,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  color: "success" | "warning" | "gold";
}) {
  const styles = {
    success: "text-[oklch(0.78_0.18_150)] bg-[oklch(0.72_0.18_150_/_0.12)]",
    warning: "text-[oklch(0.85_0.16_60)] bg-[oklch(0.78_0.16_60_/_0.12)]",
    gold: "text-[oklch(0.83_0.16_88)] bg-[oklch(0.83_0.16_88_/_0.12)]",
  };
  return (
    <div className="glass-card rounded-xl p-6">
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium mb-4",
          styles[color],
        )}
      >
        {icon}
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground/85 flex gap-2">
              <span className="text-[oklch(0.83_0.16_88)] flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">Nada relevante a destacar.</div>
      )}
    </div>
  );
}
