import { useState, useEffect } from "react";
import { Printer } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GoldTooltip } from "@/components/dashboard/GoldTooltip";
import { Button } from "@/components/ui/button";
import { timeSeries, type Totals } from "@/lib/csv/aggregate";
import type { AccountDiagnosis, DiagnosedCampaign } from "@/lib/csv/diagnostics";
import { fmtBRL, fmtNum, fmtPct, fmtCompact } from "@/lib/csv/format";
import type { AnalysisMode } from "@/lib/csv/types";
import { GOLD } from "./theme";
import { getKpis } from "./kpis";
import { useDashboard } from "./context";

export function ReportTab({
  totals,
  diagnosed,
  dx,
  mode,
  series,
  hasDate,
}: {
  totals: Totals;
  diagnosed: DiagnosedCampaign[];
  dx: AccountDiagnosis;
  mode: AnalysisMode;
  series: ReturnType<typeof timeSeries>;
  hasDate: boolean;
}) {
  const { config } = useDashboard();
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const kpis = getKpis(totals, mode, config?.customKpis, [], isMobile);
  const top = [...diagnosed].sort((a, b) => b.spend - a.spend).slice(0, 15);

  return (
    <div className="bg-[oklch(0.13_0_0)] border border-[oklch(0.83_0.16_88_/_0.15)] rounded-2xl p-4 sm:p-8 md:p-12 print:p-0 print:border-none print:bg-transparent">
      <div className="flex items-end justify-between flex-wrap gap-4 pb-6 border-b border-[oklch(0.83_0.16_88_/_0.2)]">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[oklch(0.83_0.16_88)] mb-2">
            Relatório de Performance
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">
            {config?.clientName || "Análise de Campanhas"}
          </h1>
          {config?.period && (
            <p className="text-sm text-muted-foreground mt-1">Período: {config.period}</p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-display text-xl gold-text">Audiência de Ouro</div>
          <div>Relatório gerado pelo Dashboard de Ouro</div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold mb-4 text-[oklch(0.83_0.16_88)]">
          Resumo executivo
        </h2>
        <p className="text-sm leading-relaxed text-foreground/85">{dx.summary}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-[oklch(0.83_0.16_88_/_0.2)] p-4 bg-[oklch(0.16_0_0)]"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <div className="font-display text-2xl font-bold gold-text mt-1">{k.value}</div>
            </div>
          ))}
        </div>
      </section>

      {hasDate && series.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-4 text-[oklch(0.83_0.16_88)]">
            Evolução do investimento
          </h2>
          <div className="bg-[oklch(0.16_0_0)] p-4 rounded-xl border border-[oklch(0.83_0.16_88_/_0.1)]">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="reportGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                <XAxis
                  dataKey="date"
                  stroke="oklch(0.6 0 0)"
                  fontSize={10}
                  tickFormatter={(v) => v.split("/").slice(0, 2).join("/")}
                  interval={0}
                  minTickGap={10}
                />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip content={<GoldTooltip formatter={(v) => fmtBRL(v)} />} />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke={GOLD}
                  fill="url(#reportGold)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="mt-8 print-page">
        <h2 className="font-display text-xl font-semibold mb-4 text-[oklch(0.83_0.16_88)]">
          Detalhamento de Campanhas
        </h2>
        <div className="overflow-hidden rounded-xl border border-[oklch(0.83_0.16_88_/_0.15)] bg-[oklch(0.16_0_0)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-[oklch(0.83_0.16_88_/_0.2)] text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Campanha</th>
                <th className="px-2 py-3 text-right">Invest.</th>
                <th className="px-2 py-3 text-right">Result.</th>
                <th className="px-2 py-3 text-right">CTR</th>
                {mode === "sales" && <th className="px-2 py-3 text-right">ROAS</th>}
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c) => (
                <tr
                  key={c.key}
                  className="border-b border-[oklch(0.83_0.16_88_/_0.08)] last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{c.key}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{fmtBRL(c.spend)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {fmtNum(c.results || c.purchases || c.conversations || c.thruplays)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                  {mode === "sales" && (
                    <td className="px-2 py-3 text-right tabular-nums font-bold text-[oklch(0.83_0.16_88)]">
                      {c.roas > 0 ? `${fmtNum(c.roas, 2)}x` : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="bg-[oklch(0.16_0_0)] p-6 rounded-xl border border-[oklch(0.83_0.16_88_/_0.1)]">
          <h2 className="font-display text-xl font-semibold mb-3 text-[oklch(0.83_0.16_88)]">
            Principais aprendizados
          </h2>
          <ul className="space-y-3 text-sm">
            {[...dx.strengths, ...dx.opportunities].slice(0, 8).map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-[oklch(0.83_0.16_88)] shrink-0">•</span>
                <span className="text-foreground/90">{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[oklch(0.16_0_0)] p-6 rounded-xl border border-[oklch(0.83_0.16_88_/_0.1)]">
          <h2 className="font-display text-xl font-semibold mb-3 text-[oklch(0.83_0.16_88)]">
            Próximos passos
          </h2>
          <ul className="space-y-3 text-sm">
            {dx.warnings.length > 0 ? (
              dx.warnings.slice(0, 8).map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-destructive shrink-0">→</span>
                  <span className="text-foreground/90">{s}</span>
                </li>
              ))
            ) : (
              <li className="flex gap-3 text-muted-foreground">
                Manter monitoramento da performance atual.
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="mt-10 pt-6 border-t border-[oklch(0.83_0.16_88_/_0.2)] no-print flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-muted-foreground">
          Relatório gerado por{" "}
          <strong className="text-[oklch(0.83_0.16_88)]">Audiência de Ouro</strong>
        </div>
        <Button onClick={() => window.print()} className="gold-gradient text-black font-semibold">
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>
    </div>
  );
}
