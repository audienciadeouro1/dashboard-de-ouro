import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  createContext,
  useContext,
} from "react";
import {
  ArrowLeft,
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  TrendingUp,
  Users,
  Repeat,
  MessageCircle,
  ShoppingBag,
  Play,
  Heart,
  Award,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Printer,
  RefreshCw,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  Brush,
} from "recharts";

import { BrandHeader } from "@/components/BrandHeader";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GoldTooltip } from "@/components/dashboard/GoldTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Calendar } from "lucide-react"; // Renomeando lucide icon
import { Calendar as CalendarComponent } from "@/components/ui/calendar"; // Shadcn component

import { getData, subscribe, setConfig } from "@/lib/store";
import { checkSession } from "@/lib/api";
import { aggregate, timeSeries, totals as computeTotals, parseDate } from "@/lib/csv/aggregate";
import type { Aggregated, Totals } from "@/lib/csv/aggregate";
import { diagnoseCampaigns, diagnoseAccount } from "@/lib/csv/diagnostics";
import { fmtBRL, fmtBRLNoCents, fmtNum, fmtPct, fmtCompact } from "@/lib/csv/format";
import type { AdRow, AnalysisMode, ParsedDataset, ReportConfig } from "@/lib/csv/types";
import type { CanonicalKey } from "@/lib/csv/normalize";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, ChevronRight, PlusCircle, Hash, ShieldCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  GOLD,
  GOLD_BRIGHT,
  GOLD_DARK,
  SUCCESS,
  DANGER,
  WARNING,
  PALETTE,
} from "@/components/dashboard/theme";
import { METRIC_CONFIGS } from "@/components/dashboard/metric-configs";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { QualityBadge } from "@/components/dashboard/QualityBadge";
import { toISODate } from "@/lib/dates";
import { getKpis, type KpiDef } from "@/components/dashboard/kpis";
import {
  Highlight,
  EmptyChart,
  MetricSelector,
  RankRow,
  DxList,
} from "@/components/dashboard/shared";
import { DashboardContext, useDashboard } from "@/components/dashboard/context";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { CampaignsTab } from "@/components/dashboard/CampaignsTab";
import { AggregatedTab } from "@/components/dashboard/AggregatedTab";
import { AdsTab } from "@/components/dashboard/AdsTab";
import { ChartsTab } from "@/components/dashboard/ChartsTab";
import { DiagnosisTab } from "@/components/dashboard/DiagnosisTab";
import { DataQualityTab } from "@/components/dashboard/DataQualityTab";
import { ReportTab } from "@/components/dashboard/ReportTab";
import { FunnelTab } from "@/components/dashboard/FunnelTab";
import { CompareTab } from "@/components/dashboard/CompareTab";
import { ClientDiagnosticsTab } from "@/components/dashboard/ClientDiagnosticsTab";
import type { FunnelResult } from "@/lib/metrics/funnel";
import type { ClientDiagnostics } from "@/lib/server/diagnostics";
import type { StrategicMemory } from "@/lib/metrics/strategic-memory";
import { normalizeDateToISO } from "@/lib/dates";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await checkSession();
    if (!session.authenticated) {
      throw redirect({ to: "/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Dashboard — Dashboard de Ouro" },
      { name: "description", content: "Análise visual de campanhas Meta Ads." },
    ],
  }),
  component: DashboardLayout,
});

// /dashboard é um contêiner: renderiza as rotas filhas (ex: /dashboard/$clientSlug).
// A página baseada em memória (Maria Maria pós-upload) vive em dashboard.index.tsx.
function DashboardLayout() {
  return <Outlet />;
}

function useStore() {
  return useSyncExternalStore(
    subscribe,
    () => getData(),
    () => getData(),
  );
}

export function DashboardContent({
  dataOverride,
  uploadSlug,
  onDateRangeChange,
  funnel,
  diagnostics,
  strategicMemory,
  clientId,
  clientLogoUrl,
  onCustomKpisChange,
}: {
  dataOverride?: { dataset: ParsedDataset; config: ReportConfig };
  uploadSlug?: string;
  /** Foto de perfil do cliente (dashboards de cliente); null/ausente mostra as iniciais. */
  clientLogoUrl?: string | null;
  /** Dashboards de cliente: propaga o período para o servidor (search params). Análise avulsa não passa. */
  onDateRangeChange?: (range: { from?: Date; to?: Date } | undefined) => void;
  /** Funil real (Meta + comercial) calculado no servidor; presente só quando há config + dados comerciais. */
  funnel?: FunnelResult | null;
  /** Diagnósticos determinísticos do dashboard persistido. */
  diagnostics?: ClientDiagnostics | null;
  /** Tarefas e decisões registradas para este cliente. */
  strategicMemory?: StrategicMemory | null;
  clientId?: number;
  /** Dashboards de cliente: persiste as métricas extras no banco. */
  onCustomKpisChange?: (kpis: CanonicalKey[]) => void;
} = {}) {
  const store = useStore();
  const dataset = dataOverride?.dataset ?? store.dataset;
  const config = dataOverride?.config ?? store.config;

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>();
  // Atualiza o filtro local (memória) e, nos dashboards de cliente, também o servidor.
  const handleDateRange = (range: { from?: Date; to?: Date } | undefined) => {
    setDateRange(range);
    onDateRangeChange?.(range);
  };
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [adSetFilter, setAdSetFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");

  if (!dataset || !config) return null;

  const isMariaMaria = config.mode === "maria-maria" && !!dataset.mariaMaria;
  const effectiveMode = isMariaMaria ? "leads" : config.mode;

  // Aba Funil aparece quando há um funil com pelo menos 2 etapas e dados no topo
  // (funil comercial da Maria Maria ou funil de pixel do Aki Sushi).
  const showFunnel = Boolean(funnel && funnel.stages.length >= 2 && funnel.stages[0].count > 0);

  // Comparador: só nos dashboards de cliente (têm slug) e com dados datados.
  const showCompare = Boolean(uploadSlug && dataset.hasDate);
  const showDiagnostics = Boolean(uploadSlug && diagnostics);
  const maxDate = useMemo(() => {
    if (!dataset.hasDate) return null;
    let max: string | null = null;
    for (const r of dataset.rows) {
      const iso = normalizeDateToISO(r.date);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && (!max || iso > max)) max = iso;
    }
    return max;
  }, [dataset.rows, dataset.hasDate]);

  // listas únicas
  const allCampaigns = useMemo(
    () => Array.from(new Set(dataset?.rows.map((r) => r.campaignName).filter(Boolean) || [])),
    [dataset?.rows],
  );
  const allAdSets = useMemo(
    () => Array.from(new Set(dataset?.rows.map((r) => r.adSetName).filter(Boolean) || [])),
    [dataset?.rows],
  );

  const filteredRows: AdRow[] = useMemo(() => {
    if (!dataset) return [];
    return dataset.rows.filter((r) => {
      // Filtro de Data
      if (dateRange?.from) {
        const rowDate = parseDate(r.date);
        if (rowDate === 0) return false;

        const from = startOfDay(dateRange.from).getTime();
        const to = dateRange.to ? endOfDay(dateRange.to).getTime() : from;

        if (rowDate < from || rowDate > to) return false;
      }

      if (campaignFilter !== "all" && r.campaignName !== campaignFilter) return false;
      if (adSetFilter !== "all" && r.adSetName !== adSetFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          r.campaignName?.toLowerCase().includes(q) ||
          r.adSetName?.toLowerCase().includes(q) ||
          r.adName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [dataset, dateRange, campaignFilter, adSetFilter, search]);

  const totals = useMemo(() => computeTotals(filteredRows), [filteredRows]);
  const byCampaign = useMemo(() => aggregate(filteredRows, "campaignName"), [filteredRows]);
  const byAdSet = useMemo(() => aggregate(filteredRows, "adSetName"), [filteredRows]);
  const byAd = useMemo(() => aggregate(filteredRows, "adName"), [filteredRows]);
  const series = useMemo(() => timeSeries(filteredRows), [filteredRows]);
  const diagnosed = useMemo(
    () => diagnoseCampaigns(byCampaign, totals, effectiveMode),
    [byCampaign, totals, effectiveMode],
  );
  const accountDx = useMemo(
    () => diagnoseAccount(totals, diagnosed, effectiveMode),
    [totals, diagnosed, effectiveMode],
  );

  if (!dataset || !config) return null;

  const clientInitials =
    (config.clientName || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <DashboardContext.Provider value={{ dataset, config, onCustomKpisChange }}>
      <div className="min-h-screen">
        <BrandHeader
          showHomeLink
          right={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.print()}
                className="text-foreground/80 hover:text-[oklch(0.83_0.16_88)]"
              >
                <Printer className="w-4 h-4 sm:mr-1.5" />{" "}
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[oklch(0.83_0.16_88_/_0.3)] hover:border-[oklch(0.83_0.16_88_/_0.6)]"
              >
                {uploadSlug ? (
                  <Link to="/upload/$clientSlug" params={{ clientSlug: uploadSlug }}>
                    <RefreshCw className="w-4 h-4 sm:mr-1.5" />{" "}
                    <span className="hidden sm:inline">Atualizar dados</span>
                  </Link>
                ) : (
                  <Link to="/">
                    <RefreshCw className="w-4 h-4 sm:mr-1.5" />{" "}
                    <span className="hidden sm:inline">Trocar arquivo</span>
                  </Link>
                )}
              </Button>
            </div>
          }
        />

        <main className="mx-auto max-w-[1600px] px-6 py-8 space-y-6">
          {/* Header info */}
          <div className="flex items-end justify-between flex-wrap gap-4 no-print">
            <div>
              <Link
                to="/"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-[oklch(0.83_0.16_88)] mb-2"
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> Voltar ao painel
              </Link>
              <div className="flex items-center gap-4">
                {uploadSlug && (
                  <Avatar className="h-14 w-14 border border-[oklch(0.83_0.16_88_/_0.3)]">
                    {clientLogoUrl && <AvatarImage src={clientLogoUrl} alt={config.clientName} />}
                    <AvatarFallback className="bg-[oklch(0.83_0.16_88_/_0.12)] text-[oklch(0.88_0.18_92)] text-lg font-semibold">
                      {clientInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
                <h1 className="font-display text-3xl md:text-4xl font-bold">
                  {config.clientName || "Análise de Campanhas"}
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {config.period && <span>{config.period} · </span>}
                {filteredRows.length} de {dataset.totalRows} linhas ·{" "}
                <span className="text-[oklch(0.83_0.16_88)] capitalize">modo {config.mode}</span>
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-3 no-print">
            <div className="relative w-full md:flex-1 md:min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar campanha, conjunto ou anúncio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]"
              />
            </div>
            <DateRangePicker date={dateRange} setDate={handleDateRange} />
            {uploadSlug && (
              <QualityBadge
                slug={uploadSlug}
                start={dateRange?.from ? toISODate(dateRange.from) : undefined}
                end={dateRange?.to ? toISODate(dateRange.to) : undefined}
              />
            )}
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-full sm:w-[220px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {allCampaigns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dataset.hasAdSet && (
              <Select value={adSetFilter} onValueChange={setAdSetFilter}>
                <SelectTrigger className="w-full sm:w-[220px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
                  <SelectValue placeholder="Conjunto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os conjuntos</SelectItem>
                  {allAdSets.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <TabsList className="bg-[oklch(0.14_0_0)] border border-[oklch(0.83_0.16_88_/_0.15)] p-1 h-12 flex flex-row overflow-x-auto justify-start max-w-full no-scrollbar flex-nowrap no-print w-full sm:w-auto">
              {[
                ["overview", "Visão Geral"],
                ...(showFunnel ? [["funnel", "Funil"]] : []),
                ...(showCompare ? [["compare", "Comparar"]] : []),
                ["campaigns", "Campanhas"],
                ["adsets", "Conjuntos"],
                ["ads", "Anúncios"],
                ["charts", "Gráficos"],
                ["diagnosis", showDiagnostics ? "Diagnóstico" : "Análise"],
                ["data", "Qualidade dos Dados"],
                ["report", "Relatório"],
              ].map(([id, label]) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="data-[state=active]:bg-[oklch(0.83_0.16_88_/_0.15)] data-[state=active]:text-[oklch(0.88_0.18_92)] text-xs md:text-sm flex-shrink-0"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                totals={totals}
                series={series}
                diagnosed={diagnosed}
                mode={effectiveMode}
                hasDate={dataset.hasDate}
                byCampaign={byCampaign}
                dateRange={dateRange}
              />
            </TabsContent>
            {showFunnel && funnel && (
              <TabsContent value="funnel">
                <FunnelTab funnel={funnel} />
              </TabsContent>
            )}
            {showCompare && uploadSlug && (
              <TabsContent value="compare">
                <CompareTab slug={uploadSlug} maxDate={maxDate} />
              </TabsContent>
            )}
            <TabsContent value="campaigns">
              <CampaignsTab diagnosed={diagnosed} mode={effectiveMode} />
            </TabsContent>
            <TabsContent value="adsets">
              <AggregatedTab
                data={byAdSet}
                mode={effectiveMode}
                dimensionLabel="Conjunto de anúncios"
              />
            </TabsContent>
            <TabsContent value="ads">
              <AdsTab data={byAd} />
            </TabsContent>
            <TabsContent value="charts">
              <ChartsTab
                byCampaign={byCampaign}
                series={series}
                hasDate={dataset.hasDate}
                mode={effectiveMode}
                totals={totals}
              />
            </TabsContent>
            <TabsContent value="diagnosis">
              {diagnostics && clientId ? (
                <ClientDiagnosticsTab
                  clientId={clientId}
                  goals={diagnostics.goals}
                  diagnostics={diagnostics.diagnostics}
                  alerts={diagnostics.alerts}
                  strategicMemory={strategicMemory ?? { tasks: [], decisions: [] }}
                />
              ) : (
                <DiagnosisTab dx={accountDx} diagnosed={diagnosed} mode={effectiveMode} />
              )}
            </TabsContent>
            <TabsContent value="data">
              <DataQualityTab />
            </TabsContent>
            <TabsContent value="report">
              <ReportTab
                totals={totals}
                diagnosed={diagnosed}
                dx={accountDx}
                mode={effectiveMode}
                series={series}
                hasDate={dataset.hasDate}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </DashboardContext.Provider>
  );
}

/* ============ KPI definitions per mode ============ */

/* ============ Tabs ============ */

/* ============ Campaigns Tab ============ */

/* ============ AdSets / generic aggregated tab ============ */

/* ============ Ads Tab ============ */

/* ============ Charts Tab ============ */

/* ============ Diagnosis Tab ============ */

/* ============ Data Quality Tab ============ */

/* ============ Report Tab (printable) ============ */
