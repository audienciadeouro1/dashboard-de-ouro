import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "./DateRangePicker";
import { fetchClientComparison } from "@/lib/api";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/csv/format";
import { toISODate } from "@/lib/dates";
import {
  computeComparePeriods,
  precedingRange,
  pctChange,
  type Range,
} from "@/lib/metrics/compare";
import type { ClientComparison } from "@/lib/server/compare";

type Preset = "7d" | "30d" | "custom";

// "up" = quanto maior, melhor; "down" = quanto menor, melhor; "neutral" = sem cor.
type Direction = "up" | "down" | "neutral";

interface MetricDef {
  label: string;
  get: (side: ClientComparison["a"]) => number;
  fmt: (v: number) => string;
  dir: Direction;
}

function labelRange(r: Range): string {
  const br = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  };
  return `${br(r.start)} – ${br(r.end)}`;
}

function DeltaBadge({ value, dir }: { value: number; dir: Direction }) {
  const isFlat = Math.abs(value) < 0.001 || dir === "neutral";
  const good = dir === "up" ? value > 0 : value < 0;
  const color = isFlat
    ? "text-muted-foreground"
    : good
      ? "text-[#10B981]"
      : "text-destructive";
  const Icon = isFlat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {value > 0 ? "+" : ""}
      {fmtPct(value * 100, 1)}
    </span>
  );
}

export function CompareTab({ slug, maxDate }: { slug: string; maxDate: string | null }) {
  const [preset, setPreset] = useState<Preset>("7d");
  const [customA, setCustomA] = useState<{ from?: Date; to?: Date } | undefined>();
  const [data, setData] = useState<ClientComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deriva os períodos A e B a partir do preset (ou do intervalo personalizado).
  const ranges = useMemo<{ a: Range; b: Range } | null>(() => {
    if (preset === "custom") {
      if (!customA?.from || !customA?.to) return null;
      const a: Range = { start: toISODate(customA.from), end: toISODate(customA.to) };
      return { a, b: precedingRange(a) };
    }
    if (!maxDate) return null;
    return computeComparePeriods(maxDate, preset);
  }, [preset, customA, maxDate]);

  useEffect(() => {
    if (!ranges) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchClientComparison({ data: { slug, a: ranges.a, b: ranges.b } })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao comparar períodos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, ranges]);

  const metrics = useMemo<MetricDef[]>(() => {
    const base: MetricDef[] = [
      { label: "Investimento", get: (s) => s.totals.spend, fmt: fmtBRL, dir: "neutral" },
      {
        label: "Faturamento",
        get: (s) => s.funnel?.revenue ?? s.totals.conversionValue,
        fmt: fmtBRL,
        dir: "up",
      },
      {
        label: "ROAS",
        get: (s) => s.funnel?.roas ?? s.totals.roas,
        fmt: (v) => `${fmtNum(v, 2)}x`,
        dir: "up",
      },
      { label: "Impressões", get: (s) => s.totals.impressions, fmt: (v) => fmtNum(v), dir: "up" },
      { label: "Cliques", get: (s) => s.totals.clicks, fmt: (v) => fmtNum(v), dir: "up" },
      { label: "Conversas", get: (s) => s.totals.conversations, fmt: (v) => fmtNum(v), dir: "up" },
      { label: "Compras", get: (s) => s.totals.purchases, fmt: (v) => fmtNum(v), dir: "up" },
    ];
    // CAC só faz sentido quando há funil (vendas definidas).
    if (data?.a.funnel) {
      base.push({
        label: "CAC",
        get: (s) => s.funnel?.cac ?? 0,
        fmt: fmtBRL,
        dir: "down",
      });
    }
    return base;
  }, [data]);

  const presets: { id: Preset; label: string }[] = [
    { id: "7d", label: "7 dias" },
    { id: "30d", label: "30 dias" },
    { id: "custom", label: "Personalizado" },
  ];

  return (
    <div className="space-y-6">
      {/* Seletor de preset */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <Button
            key={p.id}
            variant={preset === p.id ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
        {preset === "custom" && (
          <DateRangePicker date={customA} setDate={setCustomA} />
        )}
      </div>

      {!maxDate && preset !== "custom" && (
        <p className="text-sm text-muted-foreground">Sem dados com data para comparar.</p>
      )}
      {preset === "custom" && !ranges && (
        <p className="text-sm text-muted-foreground">
          Escolha um período (A). O período anterior de mesmo tamanho (B) é calculado automaticamente.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {ranges && data && (
        <div className="glass-card rounded-2xl p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 pr-4">Métrica</th>
                <th className="text-right font-medium py-2 px-4">
                  Período A
                  <div className="text-xs font-normal text-[oklch(0.83_0.16_88)]">
                    {labelRange(data.a.range)}
                  </div>
                </th>
                <th className="text-right font-medium py-2 px-4">
                  Período B
                  <div className="text-xs font-normal text-muted-foreground">
                    {labelRange(data.b.range)}
                  </div>
                </th>
                <th className="text-right font-medium py-2 pl-4">Variação</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const va = m.get(data.a);
                const vb = m.get(data.b);
                return (
                  <tr key={m.label} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 text-foreground">{m.label}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-foreground">
                      {m.fmt(va)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{m.fmt(vb)}</td>
                    <td className="py-2.5 pl-4 text-right">
                      <DeltaBadge value={pctChange(va, vb)} dir={m.dir} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <p className="mt-3 text-xs text-muted-foreground">Atualizando…</p>}
        </div>
      )}
    </div>
  );
}
