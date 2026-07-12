import { useState, useMemo, useEffect } from "react";
import { DollarSign, Target, TrendingUp, Users, MessageCircle, Award, AlertTriangle, Lightbulb, Sparkles, ClipboardList, UserCheck, Trash2, ShieldCheck } from "lucide-react";
import { ResponsiveContainer, Area, BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush } from "recharts";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { GoldTooltip } from "@/components/dashboard/GoldTooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfDay, endOfDay } from "date-fns";
import { setConfig } from "@/lib/store";
import { timeSeries, type Aggregated, type Totals } from "@/lib/csv/aggregate";
import type { DiagnosedCampaign } from "@/lib/csv/diagnostics";
import { fmtBRL, fmtNum, fmtPct, fmtCompact } from "@/lib/csv/format";
import type { AnalysisMode } from "@/lib/csv/types";
import type { CanonicalKey } from "@/lib/csv/normalize";
import { GOLD, SUCCESS } from "./theme";
import { METRIC_CONFIGS } from "./metric-configs";
import { getKpis } from "./kpis";
import { Highlight, EmptyChart, MetricSelector } from "./shared";
import { useDashboard } from "./context";

interface OverviewProps {
  totals: Totals;
  series: ReturnType<typeof timeSeries>;
  diagnosed: DiagnosedCampaign[];
  mode: AnalysisMode;
  hasDate: boolean;
  dateRange?: { from?: Date; to?: Date };
}

export function OverviewTab({
  totals,
  series,
  diagnosed,
  mode,
  hasDate,
  byCampaign,
  dateRange,
}: OverviewProps & { byCampaign: Aggregated[] }) {
  const { config, dataset, onCustomKpisChange } = useDashboard();

  // Persiste as métricas extras: no dashboard de cliente grava no banco (callback),
  // na análise avulsa usa o store em memória.
  const applyCustomKpis = (next: CanonicalKey[]) => {
    if (onCustomKpisChange) onCustomKpisChange(next);
    else setConfig({ customKpis: next });
  };
  
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  // Cores Premium solicitadas
  const COLOR_INVEST = "#F59E0B"; // Amarelo/Amber premium
  const COLOR_REVENUE = "#10B981"; // Verde/Emerald premium

  const [chartMetric, setChartMetric] = useState<string>("comparison");

  const activeFormatter = useMemo(() => {
    if (
      chartMetric === "spend" ||
      chartMetric === "conversionValue" ||
      chartMetric === "costPerConversation" ||
      chartMetric === "comparison"
    ) {
      return fmtBRL;
    }
    if (chartMetric === "roas") {
      return (v: number) => `${fmtNum(v, 2)}x`;
    }
    return (v: number) => fmtNum(v);
  }, [chartMetric]);

  // Ativa automaticamente o modo comparativo se houver dados de faturamento (Negócio ou Meta Sales)
  useEffect(() => {
    const hasFaturamento = dataset?.mariaMaria || mode === "sales";
    if (hasFaturamento) {
      setChartMetric("comparison");
    } else {
      setChartMetric(mode === "leads" ? "conversations" : "spend");
    }
  }, [mode, !!dataset?.mariaMaria]);

  const kpis = getKpis(totals, mode, config?.customKpis, byCampaign, isMobile);

  const filteredWeeks = useMemo(() => {
    if (!dataset?.mariaMaria) return [];
    if (!dateRange?.from) return dataset.mariaMaria.weeks;

    const from = startOfDay(dateRange.from).getTime();
    const to = dateRange.to ? endOfDay(dateRange.to).getTime() : from;

    return dataset.mariaMaria.weeks.filter((w) => {
      // Uma semana é incluída se houver qualquer sobreposição com o filtro
      return w.startDate <= to && w.endDate >= from;
    });
  }, [dataset?.mariaMaria, dateRange]);

  const businessSeries = useMemo(() => {
    if (!dataset?.mariaMaria) return [];
    return filteredWeeks.map((w) => ({
      date: format(new Date(w.startDate), "dd/MM/yyyy"),
      investimento: w.metaData.spend,
      faturamento: w.salonData.totalFaturamento,
    }));
  }, [dataset?.mariaMaria, filteredWeeks]);

  const mmConsolidated = useMemo(() => {
    if (filteredWeeks.length === 0) return null;
    return filteredWeeks.reduce(
      (acc, w) => ({
        faturamento: acc.faturamento + w.salonData.totalFaturamento,
        investimento: acc.investimento + w.metaData.spend,
        agendamentosBrutos: acc.agendamentosBrutos + w.salonData.agendamentos,
        agendamentosComServico: acc.agendamentosComServico + w.salonData.agendamentosComServico,
        contatos: acc.contatos + w.salonData.contatosWhatsapp,
        conversations: acc.conversations + (w.metaData.conversations || 0),
      }),
      {
        faturamento: 0,
        investimento: 0,
        agendamentosBrutos: 0,
        agendamentosComServico: 0,
        contatos: 0,
        conversations: 0,
      },
    );
  }, [filteredWeeks]);

  const roasReal =
    mmConsolidated && mmConsolidated.investimento > 0
      ? mmConsolidated.faturamento / mmConsolidated.investimento
      : 0;
  const cacReal =
    mmConsolidated && mmConsolidated.agendamentosComServico > 0
      ? mmConsolidated.investimento / mmConsolidated.agendamentosComServico
      : 0;
  const taxaConv =
    mmConsolidated && mmConsolidated.contatos > 0
      ? (mmConsolidated.agendamentosComServico / mmConsolidated.contatos) * 100
      : 0;

  const best = [...diagnosed].sort((a, b) => {
    if (mode === "sales") return b.roas - a.roas;
    return b.spend / Math.max(1, a.spend) - 1;
  })[0];
  const biggest = [...diagnosed].sort((a, b) => b.spend - a.spend)[0];
  const scaleOpp = diagnosed.find((c) => c.status === "scale");
  const warning = diagnosed.find((c) => c.status === "pause" || c.status === "optimize");

  // Exibe todas as métricas suportadas que ainda não estão na tela
  const availableMetrics = (Object.keys(METRIC_CONFIGS) as CanonicalKey[]).filter((m) => {
    // Não mostra se já estiver nos KPIs fixos do modo
    if (kpis.some((k) => k.key === m)) return false;
    // Remove campos de identificação básica que não fazem sentido como card isolado
    if (["campaignName", "adSetName", "adName", "resultIndicator", "resultUnit"].includes(m))
      return false;
    return true;
  });

  // --- Simulador e Projeção de Investimento ---
  const [simulatedSpend, setSimulatedSpend] = useState<number>(5000);
  const baseRoas = dataset?.mariaMaria && mmConsolidated ? roasReal : totals.roas;
  const activeRoas = baseRoas > 0 && !isNaN(baseRoas) ? baseRoas : 3.0;
  const projectedRevenue = simulatedSpend * activeRoas;
  const projectionData = [
    {
      name: "Projeção",
      "Investimento Simulado": simulatedSpend,
      "Faturamento Projetado": projectedRevenue,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Maria Maria Business Metrics */}
      {mmConsolidated && (
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[oklch(0.83_0.16_88)] font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Métricas de Negócio (Maria Maria)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label="Faturamento Total"
              value={fmtBRL(mmConsolidated.faturamento)}
              icon={<DollarSign className="w-4 h-4" />}
              highlight
            />
            <KpiCard
              label="Agendamentos"
              value={fmtNum(mmConsolidated.agendamentosBrutos)}
              icon={<ClipboardList className="w-4 h-4" />}
              highlight
            />
            <KpiCard
              label="Agendamentos com Serviço"
              value={fmtNum(mmConsolidated.agendamentosComServico)}
              icon={<UserCheck className="w-4 h-4" />}
              highlight
            />
            <KpiCard
              label="ROAS Real"
              value={`${fmtNum(roasReal, 2)}x`}
              icon={<Award className="w-4 h-4" />}
              highlight
              hint="Faturamento / Gasto Meta"
            />
            <KpiCard
              label="CAC / CPA Real"
              value={fmtBRL(cacReal)}
              icon={<Target className="w-4 h-4" />}
              highlight
              hint="Gasto Meta / Agendamentos c/ Serviço"
            />
            <KpiCard
              label="Taxa de Conversão Real"
              value={fmtPct(taxaConv)}
              icon={<TrendingUp className="w-4 h-4" />}
              highlight
              hint="Lead para Cliente"
            />
          </div>
        </section>
      )}

      {/* Auditoria de Rastreamento (Underreporting Meta) */}
      {mmConsolidated && (
        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#10B981] font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Auditoria de Rastreamento (Underreporting)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label="Leads Rastreados (Meta)"
              value={fmtNum(mmConsolidated.conversations)}
              icon={<MessageCircle className="w-4 h-4" />}
            />
            <div className="relative group">
              <KpiCard
                label="Leads Não Rastreados (Bônus)"
                value={`+${fmtNum(Math.max(0, mmConsolidated.contatos - mmConsolidated.conversations))}`}
                icon={<AlertTriangle className="w-4 h-4" />}
                highlight
              />
              <div className="absolute -top-3 -right-2 bg-[#10B981] text-black text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-lg rotate-12 z-10">
                Oculto da Meta
              </div>
            </div>
            <KpiCard
              label="Total de Leads de Anúncio"
              value={fmtNum(mmConsolidated.contatos)}
              icon={<Users className="w-4 h-4" />}
              hint="Contatos reais no balcão"
            />
          </div>
        </section>
      )}

      {/* KPIs Padrão */}
      <section className="space-y-4">
        {mmConsolidated && (
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold">
            Funil Meta Ads (Leads)
          </h2>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <div key={`${k.label}-${k.key || i}`} className="group relative">
              <KpiCard {...k} highlight={i === 0 || (mode === "sales" && k.key === "roas")} />
              {k.key && config?.customKpis?.includes(k.key) && (
                <button
                  onClick={() => {
                    const current = config.customKpis || [];
                    applyCustomKpis(current.filter((x) => x !== k.key));
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center no-print z-10"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Botão Adicionar Métrica */}
          {availableMetrics.length > 0 && (
            <MetricSelector
              available={availableMetrics}
              onSelect={(m) => {
                const current = config?.customKpis || [];
                if (!current.includes(m)) {
                  applyCustomKpis([...current, m]);
                }
              }}
            />
          )}
        </div>
      </section>

      {/* Time series + highlights */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-6 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Gráfico de Performance</h3>
              <p className="text-xs text-muted-foreground">
                {hasDate ? "Evolução métrica ao longo do tempo" : "Sem coluna de data no CSV"}
              </p>
            </div>
            <Select value={chartMetric} onValueChange={setChartMetric}>
              <SelectTrigger className="w-[200px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] h-9 no-print">
                <SelectValue placeholder="Selecionar métrica" />
              </SelectTrigger>
              <SelectContent className="bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
                {(mode === "sales" || dataset?.mariaMaria) && (
                  <SelectItem value="comparison">
                    Investimento vs Faturamento
                  </SelectItem>
                )}
                {mode === "sales" ? (
                  <>
                    <SelectItem value="spend">Investimento (R$)</SelectItem>
                    <SelectItem value="results">Vendas</SelectItem>
                    <SelectItem value="conversionValue">Faturamento (R$)</SelectItem>
                    <SelectItem value="roas">ROAS</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="conversations">Leads (Conversas)</SelectItem>
                    <SelectItem value="spend">Investimento (R$)</SelectItem>
                    <SelectItem value="costPerConversation">Custo por Lead (CPL)</SelectItem>
                  </>
                )}
                <SelectItem value="impressions">Impressões</SelectItem>
                <SelectItem value="reach">Alcance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasDate && (series.length > 0 || businessSeries.length > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={
                  chartMetric === "comparison" && dataset?.mariaMaria
                    ? businessSeries
                    : series
                }
              >
                <defs>
                  <linearGradient id="investFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR_INVEST} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLOR_INVEST} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="oklch(0.6 0 0)"
                  fontSize={10}
                  tickFormatter={(v) => v.split("/").slice(0, 2).join("/")}
                  interval={0}
                  minTickGap={10}
                />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => activeFormatter(v)} />
                <Tooltip
                  content={
                    <GoldTooltip
                      formatter={(v, name) => {
                        return activeFormatter(v as number);
                      }}
                    />
                  }
                />
                {chartMetric === "comparison" ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey={dataset?.mariaMaria ? "investimento" : "spend"}
                      name="Investimento"
                      stroke={COLOR_INVEST}
                      fill="url(#investFill)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey={dataset?.mariaMaria ? "faturamento" : "conversionValue"}
                      name="Faturamento"
                      stroke={COLOR_REVENUE}
                      strokeWidth={4}
                      dot={{ r: 4, fill: COLOR_REVENUE, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey={chartMetric}
                    name={METRIC_CONFIGS[chartMetric as CanonicalKey]?.label || "Métrica"}
                    stroke={GOLD}
                    fill="oklch(0.83 0.16 88 / 0.15)"
                    strokeWidth={2}
                  />
                )}
                <Brush
                  dataKey="date"
                  height={24}
                  stroke={GOLD}
                  fill="oklch(0.16 0 0)"
                  travellerWidth={10}
                  startIndex={
                    chartMetric === "comparison" && dataset?.mariaMaria
                      ? businessSeries.length > 30
                        ? businessSeries.length - 30
                        : 0
                      : series.length > 30
                        ? series.length - 30
                        : 0
                  }
                  tickFormatter={(v) => v.split("/").slice(0, 2).join("/")}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Dados insuficientes para série temporal" />
          )}
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4 min-w-0 overflow-hidden">
          <h3 className="font-display text-lg font-semibold">Principais destaques</h3>
          <Highlight
            icon={<Award className="w-4 h-4" />}
            label="Melhor campanha"
            value={best?.key}
            sub={
              mode === "sales" && best
                ? `ROAS ${best.roas.toFixed(2)}x`
                : best
                  ? fmtBRL(best.spend)
                  : ""
            }
          />
          <Highlight
            icon={<DollarSign className="w-4 h-4" />}
            label="Maior investimento"
            value={biggest?.key}
            sub={biggest ? fmtBRL(biggest.spend) : ""}
          />
          <Highlight
            icon={<Sparkles className="w-4 h-4" />}
            label="Oportunidade de escala"
            value={scaleOpp?.key ?? "—"}
            sub={scaleOpp?.reason ?? "Nenhuma identificada"}
            accent="success"
          />
          <Highlight
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Ponto de atenção"
            value={warning?.key ?? "—"}
            sub={warning?.reason ?? "Nenhum identificado"}
            accent="warning"
          />
        </div>
      </div>

      {/* Resumo executivo */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-5 h-5 text-[oklch(0.83_0.16_88)]" />
          <h3 className="font-display text-lg font-semibold">Resumo executivo</h3>
        </div>
        <p className="text-sm leading-relaxed text-foreground/85">
          No período analisado, foram investidos{" "}
          <strong className="text-[oklch(0.83_0.16_88)]">{fmtBRL(totals.spend)}</strong> em
          campanhas, gerando <strong>{fmtCompact(totals.impressions)}</strong> impressões e{" "}
          <strong>{fmtCompact(totals.reach)}</strong> pessoas alcançadas.{" "}
          {mode === "sales" && totals.purchases > 0 && (
            <>
              As campanhas resultaram em <strong>{fmtNum(totals.purchases)}</strong> compras,
              totalizando{" "}
              <strong className="text-[oklch(0.72_0.18_150)]">
                {fmtBRL(totals.conversionValue)}
              </strong>{" "}
              de faturamento e ROAS de <strong>{fmtNum(totals.roas, 2)}x</strong>.{" "}
            </>
          )}
          {mode === "leads" && totals.conversations > 0 && (
            <>
              Foram iniciadas <strong>{fmtNum(totals.conversations)}</strong> conversas, com custo
              médio de <strong>{fmtBRL(totals.costPerConversation)}</strong> por conversa.{" "}
            </>
          )}
          O CTR médio foi de <strong>{fmtPct(totals.ctr)}</strong> e o CPM de{" "}
          <strong>{fmtBRL(totals.cpm)}</strong>.
        </p>
      </div>

      {/* Maria Maria Weekly Performance & Detailed Table */}
      {dataset?.mariaMaria && (
        <div className="space-y-6 pt-6 border-t border-[oklch(0.83_0.16_88_/_0.15)]">
          <div className="glass-card rounded-xl p-6 md:p-8 min-w-0 overflow-hidden">
            <div className="mb-8">
              <h3 className="font-display text-2xl font-bold">Performance Meta vs Salão</h3>
              <p className="text-sm text-muted-foreground">
                Evolução do Investimento vs Faturamento Real
              </p>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={filteredWeeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
                <XAxis dataKey="semana" stroke="oklch(0.6 0 0)" fontSize={11} tickMargin={10} />
                <YAxis
                  stroke="oklch(0.6 0 0)"
                  fontSize={11}
                  tickFormatter={(v) => fmtCompact(v)}
                  label={{
                    value: "Valores (R$)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "oklch(0.5 0 0)", fontSize: 10 },
                  }}
                />
                <Tooltip
                  content={
                    <GoldTooltip
                      formatter={(v, name) => {
                        if (name === "Faturamento" || name === "Gasto Meta")
                          return fmtBRL(v as number);
                        return v;
                      }}
                    />
                  }
                />
                <Legend verticalAlign="top" align="right" height={36} />
                <Area
                  type="monotone"
                  dataKey="salonData.totalFaturamento"
                  name="Faturamento"
                  stroke={SUCCESS}
                  fill={SUCCESS}
                  fillOpacity={0.1}
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="metaData.spend"
                  name="Gasto Meta"
                  stroke={GOLD}
                  strokeWidth={3}
                  dot={{ r: 6, fill: GOLD, strokeWidth: 0 }}
                />
                <Brush
                  dataKey="semana"
                  height={24}
                  stroke={GOLD}
                  fill="oklch(0.16 0 0)"
                  travellerWidth={10}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-6">
              <h3 className="font-display text-xl font-bold">Detalhamento Semanal</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-y border-[oklch(0.83_0.16_88_/_0.2)] bg-[oklch(0.16_0_0)] text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-4">Semana</th>
                    <th className="px-3 py-4 text-right">Faturamento</th>
                    <th className="px-3 py-4 text-right">Gasto Meta</th>
                    <th className="px-3 py-4 text-right">ROAS Real</th>
                    <th className="px-3 py-4 text-right">Agend. Brutos</th>
                    <th className="px-3 py-4 text-right">Agend. Serviço</th>
                    <th className="px-3 py-4 text-right">CAC Real</th>
                    <th className="px-3 py-4 text-right">Conv. Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeeks.map((w, i) => (
                    <tr
                      key={i}
                      className="border-b border-[oklch(0.83_0.16_88_/_0.08)] hover:bg-[oklch(0.83_0.16_88_/_0.04)]"
                    >
                      <td className="px-6 py-4 font-medium">{w.semana}</td>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {fmtBRL(w.salonData.totalFaturamento)}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {fmtBRL(w.metaData.spend)}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums font-bold text-gold">
                        {fmtNum(w.roasReal, 2)}x
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {w.salonData.agendamentos}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {w.salonData.agendamentosComServico}
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums">{fmtBRL(w.cacReal)}</td>
                      <td className="px-3 py-4 text-right tabular-nums">
                        {fmtPct(w.taxaConversaoReal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Simulador e Projeção de Investimento */}
      {(dataset?.mariaMaria || mode === "sales") && (
        <div className="glass-card rounded-xl p-6 md:p-8 no-print mt-6 border border-[oklch(0.83_0.16_88_/_0.2)]">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[oklch(0.83_0.16_88)]" />
            <h3 className="font-display text-2xl font-bold">Simulador de Investimento</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-8">
            Projete seu faturamento futuro com base no ROAS {dataset?.mariaMaria && mmConsolidated ? "Real " : ""}médio de <strong className="text-[oklch(0.83_0.16_88)]">{fmtNum(activeRoas, 2)}x</strong>.
          </p>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="space-y-6 lg:col-span-1">
              <div className="space-y-3">
                <label htmlFor="simulatedSpend" className="text-sm font-semibold block uppercase tracking-wider text-muted-foreground">
                  Investimento Simulado
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    id="simulatedSpend"
                    type="number"
                    min={0}
                    step={100}
                    value={simulatedSpend || ""}
                    onChange={(e) => setSimulatedSpend(Number(e.target.value))}
                    className="pl-9 text-lg font-bold bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.3)] focus-visible:ring-[oklch(0.83_0.16_88)] h-12"
                  />
                </div>
              </div>

              <div className="p-5 rounded-lg bg-[oklch(0.16_0_0)] border border-[oklch(0.83_0.16_88_/_0.15)] space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Faturamento Projetado
                </div>
                <div className="font-display text-3xl font-bold text-[#10B981]">
                  {fmtBRL(projectedRevenue)}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectionData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    cursor={{ fill: "oklch(0.83 0.16 88 / 0.05)" }}
                    content={<GoldTooltip formatter={(v) => fmtBRL(v as number)} />}
                  />
                  <Legend verticalAlign="top" align="right" />
                  <Bar dataKey="Investimento Simulado" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={40} />
                  <Bar dataKey="Faturamento Projetado" fill="#10B981" radius={[0, 4, 4, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
