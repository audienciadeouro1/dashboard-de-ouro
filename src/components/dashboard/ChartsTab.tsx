import { useState, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, PieChart, Pie, Cell, Brush } from "recharts";
import { GoldTooltip } from "@/components/dashboard/GoldTooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timeSeries, type Aggregated, type Totals } from "@/lib/csv/aggregate";
import { fmtBRL, fmtNum, fmtCompact } from "@/lib/csv/format";
import type { AnalysisMode } from "@/lib/csv/types";
import type { CanonicalKey } from "@/lib/csv/normalize";
import { GOLD, GOLD_BRIGHT, DANGER, PALETTE } from "./theme";
import { METRIC_CONFIGS } from "./metric-configs";
import { EmptyChart } from "./shared";

export function ChartsTab({
  byCampaign,
  series,
  hasDate,
  mode,
  totals,
}: {
  byCampaign: Aggregated[];
  series: ReturnType<typeof timeSeries>;
  hasDate: boolean;
  mode: AnalysisMode;
  totals: Totals;
}) {
  const [performanceMetric, setPerformanceMetric] = useState<CanonicalKey>(
    mode === "sales" ? "results" : mode === "leads" ? "conversations" : "clicks",
  );

  const top = [...byCampaign].sort((a, b) => b.spend - a.spend).slice(0, 6);

  // Calcula série de CPA por dia
  const cpaSeries = useMemo(() => {
    return series.map((s) => ({
      date: s.date,
      cpa: s.results > 0 ? s.spend / s.results : 0,
      spend: s.spend,
      results: s.results,
    }));
  }, [series]);

  const videoFunnel =
    mode === "video"
      ? [
          { name: "Reproduções", value: totals.videoPlays },
          { name: "25%", value: totals.video25 },
          { name: "50%", value: totals.video50 },
          { name: "75%", value: totals.video75 },
          { name: "95%", value: totals.video95 },
          { name: "ThruPlay", value: totals.thruplays },
        ].filter((d) => d.value > 0)
      : [];

  const metricLabel = METRIC_CONFIGS[performanceMetric]?.label || "Resultados";

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {hasDate && series.length > 0 ? (
          <>
            {/* Gráfico Principal: Eixo Duplo */}
            <div className="glass-card rounded-xl p-6 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div>
                  <h3 className="font-display text-lg font-semibold">Desempenho x Investimento</h3>
                  <p className="text-xs text-muted-foreground">Volume de entrega vs Gasto diário</p>
                </div>
                <Select
                  value={performanceMetric}
                  onValueChange={(v) => setPerformanceMetric(v as CanonicalKey)}
                >
                  <SelectTrigger className="w-[180px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] h-9 no-print">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
                    <SelectItem value="results">Resultados</SelectItem>
                    <SelectItem value="clicks">Cliques no link</SelectItem>
                    <SelectItem value="impressions">Impressões</SelectItem>
                    <SelectItem value="reach">Alcance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="oklch(0.6 0 0)"
                    fontSize={10}
                    tickFormatter={(v) => v.split("/").slice(0, 2).join("/")}
                    interval={0}
                    minTickGap={10}
                  />
                  {/* Eixo Esquerdo: Moeda */}
                  <YAxis
                    yAxisId="left"
                    stroke="oklch(0.6 0 0)"
                    fontSize={11}
                    tickFormatter={(v) => fmtCompact(v)}
                    label={{
                      value: "Investimento",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "oklch(0.5 0 0)", fontSize: 10 },
                    }}
                  />
                  {/* Eixo Direito: Quantidade */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={GOLD}
                    fontSize={11}
                    tickFormatter={(v) => fmtCompact(v)}
                    label={{
                      value: metricLabel,
                      angle: 90,
                      position: "insideRight",
                      style: { fill: GOLD, fontSize: 10 },
                    }}
                  />
                  <Tooltip
                    content={
                      <GoldTooltip
                        formatter={(val, name) =>
                          name === "Investimento" ? fmtBRL(val as number) : fmtNum(val as number)
                        }
                      />
                    }
                  />
                  <Legend verticalAlign="top" align="right" height={36} />
                  <Bar
                    yAxisId="left"
                    dataKey="spend"
                    name="Investimento"
                    fill="oklch(0.83 0.16 88 / 0.15)"
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={performanceMetric}
                    name={metricLabel}
                    stroke={GOLD_BRIGHT}
                    strokeWidth={3}
                    dot={{ r: 4, fill: GOLD_BRIGHT, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Brush
                    dataKey="date"
                    height={24}
                    stroke={GOLD}
                    fill="oklch(0.16 0 0)"
                    travellerWidth={10}
                    startIndex={series.length > 30 ? series.length - 30 : 0}
                    tickFormatter={(v) => v.split("/").slice(0, 2).join("/")}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Gráfico de Tendência de CPA */}
            <div className="glass-card rounded-xl p-6 min-w-0 overflow-hidden">
              <h3 className="font-display text-lg font-semibold mb-1">Tendência do CPA</h3>
              <p className="text-xs text-muted-foreground mb-6">
                Custo por resultado ao longo do tempo
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={cpaSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="oklch(0.6 0 0)"
                    fontSize={10}
                    tickFormatter={(v) => v.split("/").slice(0, 2).join("/")}
                    interval={0}
                    minTickGap={10}
                  />
                  <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => fmtBRL(v)} />
                  <Tooltip content={<GoldTooltip formatter={(v) => fmtBRL(v as number)} />} />
                  <Line
                    type="stepAfter"
                    dataKey="cpa"
                    name="CPA"
                    stroke={DANGER}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="lg:col-span-2">
            <EmptyChart label="Dados temporais necessários para estas visualizações" />
          </div>
        )}

        <div className="glass-card rounded-xl p-6 min-w-0 overflow-hidden">
          <h3 className="font-display text-lg font-semibold mb-4">Distribuição de verba</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={top}
                dataKey="spend"
                nameKey="key"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                stroke="oklch(0.12 0 0)"
                strokeWidth={2}
              >
                {top.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<GoldTooltip formatter={(v) => fmtBRL(v)} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Investimento × Resultado</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
              <XAxis
                type="number"
                dataKey="spend"
                name="Investimento"
                stroke="oklch(0.6 0 0)"
                fontSize={11}
                tickFormatter={(v) => fmtCompact(v)}
              />
              <YAxis
                type="number"
                dataKey={
                  mode === "sales" ? "purchases" : mode === "leads" ? "conversations" : "clicks"
                }
                name="Resultados"
                stroke="oklch(0.6 0 0)"
                fontSize={11}
              />
              <Tooltip content={<GoldTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={byCampaign} fill={GOLD} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {videoFunnel.length > 0 && (
          <div className="glass-card rounded-xl p-6 lg:col-span-2">
            <h3 className="font-display text-lg font-semibold mb-4">Funil de retenção de vídeo</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={videoFunnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                <XAxis dataKey="name" stroke="oklch(0.6 0 0)" fontSize={11} />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  content={<GoldTooltip />}
                  cursor={{ fill: "oklch(0.83 0.16 88 / 0.05)" }}
                />
                <Bar dataKey="value" name="Visualizações" fill={GOLD} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
