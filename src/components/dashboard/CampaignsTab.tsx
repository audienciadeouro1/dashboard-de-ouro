import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GoldTooltip } from "@/components/dashboard/GoldTooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DiagnosedCampaign } from "@/lib/csv/diagnostics";
import { fmtBRL, fmtNum, fmtPct, fmtCompact } from "@/lib/csv/format";
import type { AnalysisMode } from "@/lib/csv/types";
import { GOLD } from "./theme";

export function CampaignsTab({ diagnosed, mode }: { diagnosed: DiagnosedCampaign[]; mode: AnalysisMode }) {
  const [sortKey, setSortKey] = useState<"spend" | "results" | "ctr" | "cpc" | "roas">(
    mode === "sales" ? "roas" : "spend",
  );
  const sorted = [...diagnosed].sort((a, b) => {
    const aVal = (a as unknown as Record<string, number>)[sortKey] ?? 0;
    const bVal = (b as unknown as Record<string, number>)[sortKey] ?? 0;
    return bVal - aVal;
  });

  const primaryResult = (c: DiagnosedCampaign) => {
    if (mode === "sales") return { label: "Compras", value: fmtNum(c.purchases) };
    if (mode === "leads")
      return { label: "Conversas", value: fmtNum(c.conversations) };
    if (mode === "video") return { label: "ThruPlays", value: fmtNum(c.thruplays) };
    if (mode === "awareness") return { label: "Alcance", value: fmtCompact(c.reach) };
    return { label: "Resultados", value: fmtNum(c.results || c.clicks) };
  };
  const primaryCost = (c: DiagnosedCampaign) => {
    if (mode === "sales") return c.cpa > 0 ? fmtBRL(c.cpa) : "—";
    if (mode === "leads") return c.costPerConversation > 0 ? fmtBRL(c.costPerConversation) : "—";
    if (mode === "video") return c.costPerThruplay > 0 ? fmtBRL(c.costPerThruplay) : "—";
    return c.costPerResult > 0 ? fmtBRL(c.costPerResult) : "—";
  };

  return (
    <div className="space-y-6">
      {/* Comparison chart */}
      <div className="glass-card rounded-xl p-6 min-w-0 overflow-hidden">
        <h3 className="font-display text-lg font-semibold mb-4">Comparativo de campanhas</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 32)}>
          <BarChart data={sorted.slice(0, 12)} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
            <XAxis
              type="number"
              stroke="oklch(0.6 0 0)"
              fontSize={11}
              tickFormatter={(v) => fmtCompact(v)}
            />
            <YAxis
              type="category"
              dataKey="key"
              stroke="oklch(0.6 0 0)"
              fontSize={11}
              width={150}
              tick={{ fill: "oklch(0.7 0 0)" }}
            />
            <Tooltip
              content={<GoldTooltip formatter={(v) => fmtBRL(v)} />}
              cursor={{ fill: "oklch(0.83 0.16 88 / 0.05)" }}
            />
            <Bar dataKey="spend" name="Investimento" fill={GOLD} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-6 pb-3 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-display text-lg font-semibold">Detalhamento por campanha</h3>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="w-[180px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spend">Maior investimento</SelectItem>
              <SelectItem value="roas">Maior ROAS</SelectItem>
              <SelectItem value="ctr">Maior CTR</SelectItem>
              <SelectItem value="cpc">Maior CPC</SelectItem>
              <SelectItem value="results">Mais resultados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-y border-[oklch(0.83_0.16_88_/_0.15)] text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Campanha</th>
                <th className="px-3 py-3 font-medium text-right">Invest.</th>
                <th className="px-3 py-3 font-medium text-right">
                  {primaryResult(sorted[0] ?? ({} as DiagnosedCampaign)).label}
                </th>
                <th className="px-3 py-3 font-medium text-right">Custo unit.</th>
                <th className="px-3 py-3 font-medium text-right">CTR</th>
                <th className="px-3 py-3 font-medium text-right">CPC</th>
                <th className="px-3 py-3 font-medium text-right">CPM</th>
                {mode === "sales" && <th className="px-3 py-3 font-medium text-right">ROAS</th>}
                <th className="px-6 py-3 font-medium">Recomendação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr
                  key={c.key}
                  className="border-b border-[oklch(0.83_0.16_88_/_0.08)] hover:bg-[oklch(0.83_0.16_88_/_0.04)]"
                >
                  <td className="px-6 py-3 max-w-xs truncate">{c.key}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.spend)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{primaryResult(c).value}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{primaryCost(c)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpc)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpm)}</td>
                  {mode === "sales" && (
                    <td className="px-3 py-3 text-right tabular-nums font-semibold">
                      <span
                        className={
                          c.roas >= 2
                            ? "text-[oklch(0.78_0.18_150)]"
                            : c.roas >= 1
                              ? "text-[oklch(0.85_0.16_60)]"
                              : "text-[oklch(0.78_0.18_25)]"
                        }
                      >
                        {c.roas > 0 ? `${fmtNum(c.roas, 2)}x` : "—"}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhuma campanha encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
