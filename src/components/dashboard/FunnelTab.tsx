import { TrendingDown, ArrowRight } from "lucide-react";
import type { FunnelResult } from "@/lib/metrics/funnel";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/csv/format";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-[oklch(0.88_0.18_92)]">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function FunnelTab({ funnel }: { funnel: FunnelResult }) {
  const top = funnel.stages[0]?.count ?? 0;

  // Índice da transição Meta → comercial (para o cartão de handoff).
  const firstCommercialIdx = funnel.stages.findIndex((s) => s.source === "commercial");
  const lastMeta = firstCommercialIdx > 0 ? funnel.stages[firstCommercialIdx - 1] : null;
  const firstCommercial = firstCommercialIdx >= 0 ? funnel.stages[firstCommercialIdx] : null;

  return (
    <div className="space-y-8">
      {/* KPIs reais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Faturamento" value={fmtBRL(funnel.revenue)} />
        <Kpi label="Investimento" value={fmtBRL(funnel.spend)} />
        <Kpi label="ROAS real" value={`${fmtNum(funnel.roas, 2)}x`} hint="Faturamento ÷ investimento" />
        <Kpi label="CAC real" value={fmtBRL(funnel.cac)} hint="Investimento ÷ vendas" />
        <Kpi label="Ticket real" value={fmtBRL(funnel.ticket)} hint="Faturamento ÷ vendas" />
      </div>

      {/* Funil */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">Funil real</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Do anúncio no Meta até a venda no negócio. Cada etapa mostra quantos chegaram, a taxa de
          conversão e quantos foram perdidos em relação à etapa anterior.
        </p>

        <div className="space-y-3">
          {funnel.stages.map((s, i) => {
            const width = top > 0 ? Math.max(4, (s.count / top) * 100) : 4;
            const isCommercial = s.source === "commercial";
            return (
              <div key={s.key}>
                {/* Cartão de handoff Meta → comercial */}
                {firstCommercial && lastMeta && i === firstCommercialIdx && (
                  <div className="my-4 flex items-center gap-2 rounded-lg border border-[oklch(0.83_0.16_88_/_0.25)] bg-[oklch(0.83_0.16_88_/_0.06)] px-4 py-3 text-sm text-muted-foreground">
                    <ArrowRight className="w-4 h-4 text-[oklch(0.83_0.16_88)] shrink-0" />
                    <span>
                      Transição Meta → negócio: o Meta contou{" "}
                      <strong className="text-foreground">{fmtNum(lastMeta.count)}</strong>{" "}
                      {lastMeta.label.toLowerCase()}; o negócio registrou{" "}
                      <strong className="text-foreground">{fmtNum(firstCommercial.count)}</strong>{" "}
                      {firstCommercial.label.toLowerCase()}. Medições diferentes do mesmo momento.
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">
                    {fmtNum(s.count)}
                    {s.conversionFromPrev !== null && (
                      <span className="ml-2 text-[oklch(0.83_0.16_88)]">
                        {fmtPct(s.conversionFromPrev * 100, 1)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-8 w-full rounded-md bg-[oklch(0.18_0_0)] overflow-hidden">
                  <div
                    className={
                      isCommercial
                        ? "h-full rounded-md gold-gradient"
                        : "h-full rounded-md bg-[oklch(0.83_0.16_88_/_0.35)]"
                    }
                    style={{ width: `${width}%` }}
                  />
                </div>
                {s.dropFromPrev !== null && s.dropFromPrev > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <TrendingDown className="w-3 h-3" />
                    {fmtNum(s.dropFromPrev)} perdidos nesta etapa
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
