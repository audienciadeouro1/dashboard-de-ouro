// Tooltip customizado para os gráficos Recharts no tema dourado
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}

export function GoldTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[oklch(0.83_0.16_88_/_0.4)] bg-[oklch(0.1_0_0_/_0.95)] backdrop-blur-md px-3 py-2 shadow-2xl">
      {label !== undefined && (
        <div className="text-xs uppercase tracking-wider text-[oklch(0.83_0.16_88)] mb-1.5 font-medium">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.color ?? "oklch(0.83 0.16 88)" }}
            />
            <span className="text-muted-foreground capitalize">{p.name}:</span>
            <span className="text-foreground font-semibold">
              {formatter && typeof p.value === "number"
                ? formatter(p.value, p.name ?? "")
                : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
