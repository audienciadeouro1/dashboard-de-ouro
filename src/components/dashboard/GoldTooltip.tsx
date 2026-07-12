// Tooltip customizado para os gráficos Recharts no tema dourado
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}

export function GoldTooltip({ active, payload, label, formatter }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  // Tenta encontrar os valores de investimento (gasto) e faturamento no payload para calcular o ROAS
  const spendEntry = payload.find(
    (p) =>
      p.dataKey === "spend" ||
      p.dataKey === "investimento" ||
      p.dataKey === "gasto" ||
      p.dataKey === "metaData.spend" ||
      p.name === "Investimento" ||
      p.name === "Gasto Meta" ||
      p.name === "Gasto"
  );
  const revenueEntry = payload.find(
    (p) =>
      p.dataKey === "conversionValue" ||
      p.dataKey === "faturamento" ||
      p.dataKey === "salonData.totalFaturamento" ||
      p.name === "Faturamento"
  );

  const gasto = typeof spendEntry?.value === "number" ? spendEntry.value : 0;
  const faturamento = typeof revenueEntry?.value === "number" ? revenueEntry.value : 0;

  const roas = gasto > 0 ? faturamento / gasto : 0;
  const hasBothMetrics = spendEntry && revenueEntry;

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

        {/* ROAS Dinâmico - Exibido apenas quando as métricas de investimento e faturamento estão presentes */}
        {hasBothMetrics && (
          <div className="pt-1 mt-1 border-t border-[oklch(0.83_0.16_88_/_0.1)] flex items-center justify-between gap-4">
            <span className="text-[10px] uppercase tracking-tighter text-muted-foreground">
              ROAS DINÂMICO:
            </span>
            <span className="text-[oklch(0.6_0.2_300)] font-bold text-xs drop-shadow-[0_0_8px_oklch(0.6_0.2_300_/_0.5)]">
              {roas.toFixed(2)}x
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
