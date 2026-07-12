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

  // Largura em escala de raiz quadrada: comprime a diferença gigante entre
  // impressões e as demais etapas, mantendo a ordem decrescente (cara de funil).
  const widthOf = (count: number) => {
    if (top <= 0) return 12;
    const ratio = Math.sqrt(count / top); // 0..1
    return Math.max(12, ratio * 100); // piso de 12% para etapas pequenas continuarem visíveis
  };

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
        <h3 className="font-display text-lg font-semibold text-foreground mb-1 text-center">
          Funil real
        </h3>
        <p className="text-sm text-muted-foreground mb-8 text-center max-w-xl mx-auto">
          Do anúncio no Meta até a venda no negócio. A largura de cada faixa é comparativa (escala
          suavizada) — o que vale é o número e a taxa de conversão entre etapas.
        </p>

        <div className="flex flex-col items-center gap-2">
          {funnel.stages.map((s, i) => {
            const width = widthOf(s.count);
            const isLast = i === funnel.stages.length - 1;
            // Dourado cheio para etapas comerciais e para a etapa final (a venda/conversão).
            const isCommercial = s.source === "commercial" || isLast;
            const showHandoff = firstCommercial && lastMeta && i === firstCommercialIdx;

            return (
              <div key={s.key} className="w-full flex flex-col items-center">
                {/* Cartão de handoff Meta → comercial */}
                {showHandoff && (
                  <div className="my-3 flex items-start gap-2 rounded-lg border border-[oklch(0.83_0.16_88_/_0.25)] bg-[oklch(0.83_0.16_88_/_0.06)] px-4 py-3 text-sm text-muted-foreground max-w-xl text-center">
                    <ArrowRight className="w-4 h-4 text-[oklch(0.83_0.16_88)] shrink-0 mt-0.5" />
                    <span>
                      Transição Meta → negócio: o Meta contou{" "}
                      <strong className="text-foreground">{fmtNum(lastMeta!.count)}</strong>{" "}
                      {lastMeta!.label.toLowerCase()}; o negócio registrou{" "}
                      <strong className="text-foreground">{fmtNum(firstCommercial!.count)}</strong>{" "}
                      {firstCommercial!.label.toLowerCase()}. Medições diferentes do mesmo momento.
                    </span>
                  </div>
                )}

                {/* Taxa de conversão entre a etapa anterior e esta (conector central) */}
                {s.conversionFromPrev !== null && !showHandoff && (
                  <div className="text-[11px] text-[oklch(0.83_0.16_88)] font-medium py-0.5">
                    ↓ {fmtPct(s.conversionFromPrev * 100, 1)}
                  </div>
                )}

                {/* Faixa do funil, centralizada, com nome + número no meio */}
                <div
                  className={
                    "relative mx-auto flex flex-col items-center justify-center rounded-lg py-3 px-4 min-h-[64px] transition-all " +
                    (isCommercial
                      ? "gold-gradient text-black"
                      : "bg-[oklch(0.83_0.16_88_/_0.22)] text-foreground border border-[oklch(0.83_0.16_88_/_0.3)]")
                  }
                  style={{ width: `${width}%`, minWidth: "150px", maxWidth: "100%" }}
                >
                  <span
                    className={
                      "text-xs font-medium uppercase tracking-wide " +
                      (isCommercial ? "text-black/70" : "text-muted-foreground")
                    }
                  >
                    {s.label}
                  </span>
                  <span className="font-display text-2xl font-bold leading-tight">
                    {fmtNum(s.count)}
                  </span>
                </div>

                {/* Perda em relação à etapa anterior */}
                {s.dropFromPrev !== null && s.dropFromPrev > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <TrendingDown className="w-3 h-3" />
                    {fmtNum(s.dropFromPrev)} perdidos
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
