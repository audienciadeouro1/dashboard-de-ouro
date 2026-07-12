import type { Aggregated } from "@/lib/csv/aggregate";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/csv/format";
import type { AnalysisMode } from "@/lib/csv/types";
import { RankRow } from "./shared";

export function AggregatedTab({
  data,
  mode,
  dimensionLabel,
}: {
  data: Aggregated[];
  mode: AnalysisMode;
  dimensionLabel: string;
}) {
  const sorted = [...data].sort((a, b) => b.spend - a.spend);
  if (sorted.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
        Sem dados de {dimensionLabel.toLowerCase()} no CSV.
      </div>
    );
  }
  const primaryCost = (c: Aggregated) =>
    mode === "sales"
      ? c.cpa || c.costPerResult
      : mode === "leads"
        ? c.costPerConversation || c.costPerResult
        : mode === "video"
          ? c.costPerThruplay
          : c.costPerResult || c.cpc;

  const ranked = [...sorted]
    .filter((c) => primaryCost(c) > 0)
    .sort((a, b) => primaryCost(a) - primaryCost(b));

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-1">🏆 Mais eficientes</h3>
          <p className="text-xs text-muted-foreground mb-4">Menor custo por resultado</p>
          <div className="space-y-2">
            {ranked.slice(0, 5).map((c, i) => (
              <RankRow
                key={c.key}
                rank={i + 1}
                name={c.key}
                value={fmtBRL(primaryCost(c))}
                sub={`${fmtBRL(c.spend)} investidos`}
                positive
              />
            ))}
          </div>
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-1">⚠ Custo elevado</h3>
          <p className="text-xs text-muted-foreground mb-4">Maior custo por resultado</p>
          <div className="space-y-2">
            {[...ranked]
              .reverse()
              .slice(0, 5)
              .map((c, i) => (
                <RankRow
                  key={c.key}
                  rank={i + 1}
                  name={c.key}
                  value={fmtBRL(primaryCost(c))}
                  sub={`${fmtBRL(c.spend)} investidos`}
                />
              ))}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-6 pb-3">
          <h3 className="font-display text-lg font-semibold">{dimensionLabel}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-y border-[oklch(0.83_0.16_88_/_0.15)] text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium text-right">Invest.</th>
                <th className="px-3 py-3 font-medium text-right">Resultados</th>
                <th className="px-3 py-3 font-medium text-right">Custo unit.</th>
                <th className="px-3 py-3 font-medium text-right">CTR</th>
                <th className="px-3 py-3 font-medium text-right">CPC</th>
                <th className="px-3 py-3 font-medium text-right">CPM</th>
                {mode === "sales" && <th className="px-3 py-3 font-medium text-right">ROAS</th>}
                <th className="px-3 py-3 font-medium text-right">Freq.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.key}
                  className="border-b border-[oklch(0.83_0.16_88_/_0.08)] hover:bg-[oklch(0.83_0.16_88_/_0.04)]"
                >
                  <td className="px-6 py-3 max-w-xs truncate font-medium">{c.key}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.spend)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {fmtNum(c.results || c.purchases || c.conversations || c.thruplays)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(primaryCost(c))}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">{fmtPct(c.ctr)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpc)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpm)}</td>
                  {mode === "sales" && (
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-[oklch(0.83_0.16_88)]">
                      {c.roas > 0 ? `${fmtNum(c.roas, 2)}x` : "—"}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right tabular-nums">
                    {c.frequency > 0 ? `${fmtNum(c.frequency, 2)}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
