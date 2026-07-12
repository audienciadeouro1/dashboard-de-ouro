import type { Aggregated } from "@/lib/csv/aggregate";
import { fmtBRL, fmtNum, fmtPct, fmtCompact } from "@/lib/csv/format";
import { RankRow } from "./shared";

export function AdsTab({ data }: { data: Aggregated[] }) {
  if (data.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
        Sem dados de anúncios individuais no CSV.
      </div>
    );
  }
  const byCtr = [...data].filter((c) => c.ctr > 0).sort((a, b) => b.ctr - a.ctr);
  const fadiga = data.filter((c) => c.frequency > 3.5 && c.ctr > 0 && c.ctr < 1);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-1">🥇 Maior CTR</h3>
          <p className="text-xs text-muted-foreground mb-4">Criativos que mais engajam</p>
          <div className="space-y-2">
            {byCtr.slice(0, 6).map((c, i) => (
              <RankRow
                key={c.key}
                rank={i + 1}
                name={c.key}
                value={fmtPct(c.ctr)}
                sub={`${fmtBRL(c.spend)} · ${fmtNum(c.clicks)} cliques`}
                positive
              />
            ))}
          </div>
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-1">⚠ Possível fadiga criativa</h3>
          <p className="text-xs text-muted-foreground mb-4">Frequência alta com CTR baixo</p>
          {fadiga.length > 0 ? (
            <div className="space-y-2">
              {fadiga.slice(0, 6).map((c, i) => (
                <RankRow
                  key={c.key}
                  rank={i + 1}
                  name={c.key}
                  value={`${fmtNum(c.frequency, 1)}x`}
                  sub={`CTR ${fmtPct(c.ctr)}`}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum sinal de fadiga criativa detectado.
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-6 pb-3">
          <h3 className="font-display text-lg font-semibold">Todos os anúncios</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-y border-[oklch(0.83_0.16_88_/_0.15)] text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Anúncio</th>
                <th className="px-3 py-3 font-medium text-right">Invest.</th>
                <th className="px-3 py-3 font-medium text-right">Impressões</th>
                <th className="px-3 py-3 font-medium text-right">Cliques</th>
                <th className="px-3 py-3 font-medium text-right">CTR</th>
                <th className="px-3 py-3 font-medium text-right">CPC</th>
                <th className="px-3 py-3 font-medium text-right">Freq.</th>
              </tr>
            </thead>
            <tbody>
              {[...data]
                .sort((a, b) => b.spend - a.spend)
                .map((c) => (
                  <tr
                    key={c.key}
                    className="border-b border-[oklch(0.83_0.16_88_/_0.08)] hover:bg-[oklch(0.83_0.16_88_/_0.04)]"
                  >
                    <td className="px-6 py-3 max-w-xs truncate">{c.key}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.spend)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {fmtCompact(c.impressions)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtNum(c.clicks)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpc)}</td>
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
