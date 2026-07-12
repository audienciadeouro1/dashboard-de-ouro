import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore, createContext, useContext } from "react";
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

interface DashboardContextType {
  dataset: ParsedDataset;
  config: ReportConfig;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard deve ser usado dentro de um DashboardProvider");
  return ctx;
}



export function DashboardContent({
  dataOverride,
  uploadSlug,
}: {
  dataOverride?: { dataset: ParsedDataset; config: ReportConfig };
  uploadSlug?: string;
} = {}) {
  const store = useStore();
  const dataset = dataOverride?.dataset ?? store.dataset;
  const config = dataOverride?.config ?? store.config;

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [adSetFilter, setAdSetFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");

  if (!dataset || !config) return null;

  const isMariaMaria = config.mode === "maria-maria" && !!dataset.mariaMaria;
  const effectiveMode = isMariaMaria ? "leads" : config.mode;

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

  return (
    <DashboardContext.Provider value={{ dataset, config }}>
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
              <Printer className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Imprimir</span>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-[oklch(0.83_0.16_88_/_0.3)] hover:border-[oklch(0.83_0.16_88_/_0.6)]"
            >
              {uploadSlug ? (
                <Link to="/upload/$clientSlug" params={{ clientSlug: uploadSlug }}>
                  <RefreshCw className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Atualizar dados</span>
                </Link>
              ) : (
                <Link to="/">
                  <RefreshCw className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline">Trocar arquivo</span>
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
            <h1 className="font-display text-3xl md:text-4xl font-bold">
              {config.clientName || "Análise de Campanhas"}
            </h1>
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
          <DateRangePicker date={dateRange} setDate={setDateRange} />
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
              ["campaigns", "Campanhas"],
              ["adsets", "Conjuntos"],
              ["ads", "Anúncios"],
              ["charts", "Gráficos"],
              ["diagnosis", "Diagnóstico"],
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
            <DiagnosisTab dx={accountDx} diagnosed={diagnosed} mode={effectiveMode} />
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

interface KpiDef {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  key?: CanonicalKey;
}

function getKpis(
  totals: Totals,
  mode: AnalysisMode,
  customKpis: CanonicalKey[] = [],
  byCampaign: Aggregated[] = [],
  isMobile = false,
): KpiDef[] {
  const formatBRL = (v: number) => isMobile ? fmtBRLNoCents(v) : fmtBRL(v);

  const base: KpiDef[] = [
    {
      label: "Investimento",
      value: formatBRL(totals.spend),
      icon: <DollarSign className="w-4 h-4" />,
      key: "spend",
    },
  ];

  let modeKpis: KpiDef[] = [];
  switch (mode) {
    case "sales":
      modeKpis = [
        {
          label: "Faturamento",
          value: formatBRL(totals.conversionValue),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "conversionValue",
        },
        {
          label: "ROAS",
          value: `${fmtNum(totals.roas, 2)}x`,
          icon: <Award className="w-4 h-4" />,
          key: "roas",
          hint:
            totals.roas >= 2
              ? "Acima da média"
              : totals.roas >= 1
                ? "Operação no limite"
                : "Abaixo do investido",
        },
        {
          label: "Compras",
          value: fmtNum(totals.purchases),
          icon: <ShoppingBag className="w-4 h-4" />,
          key: "purchases",
        },
        {
          label: "CPA",
          value: formatBRL(totals.cpa),
          icon: <Target className="w-4 h-4" />,
          key: "cpa",
        },
        {
          label: "Ticket médio",
          value: formatBRL(totals.ticketMedio),
          icon: <DollarSign className="w-4 h-4" />,
        },
        {
          label: "CPM",
          value: formatBRL(totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0),
          icon: <Eye className="w-4 h-4" />,
          key: "cpm",
        },
        {
          label: "Cliques no Link",
          value: fmtNum(totals.clicks || 0),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "clicks",
        },
        {
          label: "CTR (no Link)",
          value: fmtPct(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
        },
        {
          label: "CPC",
          value: formatBRL(totals.clicks > 0 ? totals.spend / totals.clicks : 0),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "cpc",
        },
        {
          label: "Impressões",
          value: fmtCompact(totals.impressions),
          icon: <Eye className="w-4 h-4" />,
          key: "impressions",
        },
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
        {
          label: "Custo por resultado",
          value: formatBRL(totals.costPerResult || totals.cpa),
          icon: <Target className="w-4 h-4" />,
          key: "costPerResult",
        },
      ];
      break;
    case "leads":
      modeKpis = [
        {
          label: "Conversas",
          value: fmtNum(totals.conversations),
          icon: <MessageCircle className="w-4 h-4" />,
          key: "conversations",
        },
        {
          label: "Custo por conversa",
          value: formatBRL(totals.costPerConversation),
          icon: <Target className="w-4 h-4" />,
          key: "costPerConversation",
        },
        {
          label: "Cliques no link",
          value: fmtNum(totals.clicks),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "clicks",
        },
        {
          label: "CTR",
          value: fmtPct(totals.ctr),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
        },
        {
          label: "CPC",
          value: formatBRL(totals.cpc),
          icon: <DollarSign className="w-4 h-4" />,
          key: "cpc",
        },
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
        { label: "CPM", value: formatBRL(totals.cpm), icon: <Eye className="w-4 h-4" />, key: "cpm" },
      ];
      break;
    case "awareness":
      modeKpis = [
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
        {
          label: "Impressões",
          value: fmtCompact(totals.impressions),
          icon: <Eye className="w-4 h-4" />,
          key: "impressions",
        },
        {
          label: "CPM",
          value: formatBRL(totals.cpm),
          icon: <Target className="w-4 h-4" />,
          key: "cpm",
        },
        {
          label: "Frequência",
          value: `${fmtNum(totals.frequency, 2)}x`,
          icon: <Repeat className="w-4 h-4" />,
          key: "frequency",
          hint: totals.frequency > 4 ? "Risco de saturação" : "Saudável",
        },
        {
          label: "Cliques",
          value: fmtNum(totals.clicks),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "clicks",
        },
        {
          label: "CTR",
          value: fmtPct(totals.ctr),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
        },
      ];
      break;
    case "engagement":
      modeKpis = [
        {
          label: "Engajamentos",
          value: fmtNum(totals.engagement || totals.clicks),
          icon: <Heart className="w-4 h-4" />,
          key: "engagement",
        },
        {
          label: "Custo por engajamento",
          value: formatBRL(totals.spend / Math.max(1, totals.engagement || totals.clicks)),
          icon: <Target className="w-4 h-4" />,
        },
        {
          label: "CTR",
          value: fmtPct(totals.ctr),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
        },
        { label: "CPM", value: formatBRL(totals.cpm), icon: <Eye className="w-4 h-4" />, key: "cpm" },
        {
          label: "Cliques",
          value: fmtNum(totals.clicks),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "clicks",
        },
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
      ];
      break;
    case "video":
      modeKpis = [
        {
          label: "Reproduções",
          value: fmtNum(totals.videoPlays),
          icon: <Play className="w-4 h-4" />,
          key: "videoPlays",
        },
        {
          label: "ThruPlays",
          value: fmtNum(totals.thruplays),
          icon: <Award className="w-4 h-4" />,
          key: "thruplays",
        },
        {
          label: "Custo / ThruPlay",
          value: fmtBRL(totals.costPerThruplay),
          icon: <Target className="w-4 h-4" />,
        },
        {
          label: "Retenção 25%",
          value:
            totals.videoPlays > 0 ? fmtPct((totals.video25 / totals.videoPlays) * 100, 1) : "—",
          icon: <TrendingUp className="w-4 h-4" />,
        },
        {
          label: "Retenção 75%",
          value:
            totals.videoPlays > 0 ? fmtPct((totals.video75 / totals.videoPlays) * 100, 1) : "—",
          icon: <TrendingUp className="w-4 h-4" />,
        },
        { label: "CPM", value: fmtBRL(totals.cpm), icon: <Eye className="w-4 h-4" />, key: "cpm" },
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
      ];
      break;
    default:
      modeKpis = [
        {
          label: "Resultados",
          value: fmtNum(totals.results),
          icon: <Target className="w-4 h-4" />,
          key: "results",
        },
        {
          label: "Cliques",
          value: fmtNum(totals.clicks),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "clicks",
        },
        {
          label: "CTR",
          value: fmtPct(totals.ctr),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
        },
        {
          label: "CPC",
          value: fmtBRL(totals.cpc),
          icon: <DollarSign className="w-4 h-4" />,
          key: "cpc",
        },
        { label: "CPM", value: fmtBRL(totals.cpm), icon: <Eye className="w-4 h-4" />, key: "cpm" },
        {
          label: "Impressões",
          value: fmtCompact(totals.impressions),
          icon: <Eye className="w-4 h-4" />,
          key: "impressions",
        },
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
      ];
  }

  const finalKpis = [...base, ...modeKpis];

  // Adiciona customizadas
  for (const k of customKpis) {
    if (finalKpis.some((item) => item.key === k)) continue;
    const conf = METRIC_CONFIGS[k];
    if (conf) {
      // Tenta pegar do total (numérico) ou da primeira linha disponível (texto/metadata)
      const numericVal = (totals as unknown as Record<string, number>)[k];
      const stringVal = (byCampaign[0] as unknown as Record<string, string>)[k];

      const val = numericVal !== undefined && numericVal !== 0 ? numericVal : stringVal;

      finalKpis.push({
        label: conf.label,
        value: typeof val === "number" ? conf.formatter(val) : String(val || "—"),
        icon: conf.icon,
        key: k,
      });
    }
  }

  return finalKpis;
}

/* ============ Tabs ============ */

interface OverviewProps {
  totals: Totals;
  series: ReturnType<typeof timeSeries>;
  diagnosed: DiagnosedCampaign[];
  mode: AnalysisMode;
  hasDate: boolean;
  dateRange?: { from?: Date; to?: Date };
}

function OverviewTab({
  totals,
  series,
  diagnosed,
  mode,
  hasDate,
  byCampaign,
  dateRange,
}: OverviewProps & { byCampaign: Aggregated[] }) {
  const { config, dataset } = useDashboard();
  
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
                    setConfig({ customKpis: current.filter((x) => x !== k.key) });
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
                const next = [...current];
                if (!next.includes(m)) {
                  next.push(m);
                  setConfig({ customKpis: next });
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

function Highlight({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  sub?: string;
  accent?: "success" | "warning";
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-[oklch(0.83_0.16_88_/_0.1)] last:border-0 last:pb-0">
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          accent === "success" && "bg-[oklch(0.72_0.18_150_/_0.15)] text-[oklch(0.78_0.18_150)]",
          accent === "warning" && "bg-[oklch(0.78_0.16_60_/_0.15)] text-[oklch(0.85_0.16_60)]",
          !accent && "bg-[oklch(0.83_0.16_88_/_0.12)] text-[oklch(0.83_0.16_88)]",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value || "—"}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sub}</div>}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-[oklch(0.83_0.16_88_/_0.15)] rounded-lg">
      {label}
    </div>
  );
}

function MetricSelector({
  available,
  onSelect,
}: {
  available: CanonicalKey[];
  onSelect: (m: CanonicalKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-full min-h-[100px] border-2 border-dashed border-[oklch(0.83_0.16_88_/_0.2)] hover:border-[oklch(0.83_0.16_88_/_0.5)] rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-[oklch(0.83_0.16_88)] transition-all group no-print">
          <PlusCircle className="w-6 h-6 opacity-50 group-hover:opacity-100" />
          <span className="text-xs font-medium uppercase tracking-wider">Adicionar métrica</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2 bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)] shadow-2xl">
        <div className="text-xs font-semibold text-muted-foreground px-2 py-1.5 uppercase tracking-wider border-b border-[oklch(0.83_0.16_88_/_0.1)] mb-1">
          Escolha uma métrica
        </div>
        <div className="grid grid-cols-1 gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
          {available.map((m) => {
            const conf = METRIC_CONFIGS[m];
            if (!conf) return null;
            return (
              <button
                key={m}
                onClick={() => {
                  onSelect(m);
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[oklch(0.83_0.16_88_/_0.15)] rounded-lg transition-all text-left w-full group"
              >
                <div className="w-8 h-8 rounded-md bg-[oklch(0.16_0_0)] flex items-center justify-center text-[oklch(0.83_0.16_88)] group-hover:scale-110 transition-transform">
                  {conf.icon}
                </div>
                <span className="text-sm font-medium group-hover:text-white transition-colors">
                  {conf.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ============ Campaigns Tab ============ */

function CampaignsTab({ diagnosed, mode }: { diagnosed: DiagnosedCampaign[]; mode: AnalysisMode }) {
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

/* ============ AdSets / generic aggregated tab ============ */

function AggregatedTab({
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

function RankRow({
  rank,
  name,
  value,
  sub,
  positive,
}: {
  rank: number;
  name: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[oklch(0.83_0.16_88_/_0.05)]">
      <div
        className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0",
          positive ? "gold-gradient text-black" : "bg-[oklch(0.22_0_0)] text-muted-foreground",
        )}
      >
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/* ============ Ads Tab ============ */

function AdsTab({ data }: { data: Aggregated[] }) {
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

/* ============ Charts Tab ============ */

function ChartsTab({
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

/* ============ Diagnosis Tab ============ */

function DiagnosisTab({
  dx,
  diagnosed,
}: {
  dx: AccountDiagnosis;
  diagnosed: DiagnosedCampaign[];
  mode: AnalysisMode;
}) {
  const ringColor = dx.score >= 65 ? SUCCESS : dx.score >= 45 ? WARNING : DANGER;
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (dx.score / 100) * circumference;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Score da conta
          </div>
          <div className="relative w-36 h-36">
            <svg className="transform -rotate-90 w-full h-full">
              <circle
                cx="72"
                cy="72"
                r="56"
                stroke="oklch(0.22 0 0)"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="72"
                cy="72"
                r="56"
                stroke={ringColor}
                strokeWidth="10"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-4xl font-bold gold-text">{dx.score}</div>
              <div className="text-xs text-muted-foreground">de 100</div>
            </div>
          </div>
          <div className="mt-4 text-lg font-semibold" style={{ color: ringColor }}>
            {dx.scoreLabel}
          </div>
        </div>

        <div className="lg:col-span-2 glass-card rounded-xl p-6 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-[oklch(0.83_0.16_88)]" />
            <h3 className="font-display text-xl font-semibold">Diagnóstico geral</h3>
          </div>
          <p className="text-foreground/85 leading-relaxed">{dx.summary}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <DxList
          title="Pontos fortes"
          items={dx.strengths}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="success"
        />
        <DxList
          title="Pontos de atenção"
          items={dx.warnings}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="warning"
        />
        <DxList
          title="Oportunidades"
          items={dx.opportunities}
          icon={<Sparkles className="w-4 h-4" />}
          color="gold"
        />
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Recomendações por campanha</h3>
        <div className="space-y-3">
          {diagnosed.map((c) => (
            <div
              key={c.key}
              className="flex items-start justify-between gap-4 pb-3 border-b border-[oklch(0.83_0.16_88_/_0.08)] last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{c.key}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.reason}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DxList({
  title,
  items,
  icon,
  color,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  color: "success" | "warning" | "gold";
}) {
  const styles = {
    success: "text-[oklch(0.78_0.18_150)] bg-[oklch(0.72_0.18_150_/_0.12)]",
    warning: "text-[oklch(0.85_0.16_60)] bg-[oklch(0.78_0.16_60_/_0.12)]",
    gold: "text-[oklch(0.83_0.16_88)] bg-[oklch(0.83_0.16_88_/_0.12)]",
  };
  return (
    <div className="glass-card rounded-xl p-6">
      <div
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium mb-4",
          styles[color],
        )}
      >
        {icon}
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground/85 flex gap-2">
              <span className="text-[oklch(0.83_0.16_88)] flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-muted-foreground">Nada relevante a destacar.</div>
      )}
    </div>
  );
}

/* ============ Data Quality Tab ============ */

function DataQualityTab() {
  const { dataset } = useDashboard();
  if (!dataset) return null;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <KpiCard
          label="Linhas importadas"
          value={fmtNum(dataset.totalRows)}
          icon={<FileSpreadsheet className="w-4 h-4" />}
        />
        <KpiCard
          label="Colunas no CSV"
          value={fmtNum(dataset.totalColumns)}
          icon={<FileSpreadsheet className="w-4 h-4" />}
        />
        <KpiCard
          label="Reconhecidas"
          value={fmtNum(dataset.recognizedColumns.length)}
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <KpiCard
          label="Não reconhecidas"
          value={fmtNum(dataset.unrecognizedColumns.length)}
          icon={<XCircle className="w-4 h-4" />}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[oklch(0.78_0.18_150)]" />
            Colunas reconhecidas
          </h3>
          <div className="flex flex-wrap gap-2">
            {dataset.recognizedColumns.map((c) => (
              <span
                key={c}
                className="text-xs px-2.5 py-1 rounded-md bg-[oklch(0.72_0.18_150_/_0.12)] text-[oklch(0.78_0.18_150)] border border-[oklch(0.72_0.18_150_/_0.3)]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            Colunas ignoradas
          </h3>
          {dataset.unrecognizedColumns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {dataset.unrecognizedColumns.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2.5 py-1 rounded-md bg-[oklch(0.22_0_0)] text-muted-foreground border border-[oklch(0.3_0_0)]"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Todas as colunas foram reconhecidas. ✨
            </div>
          )}
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Métricas indisponíveis</h3>
        {dataset.missingMetrics.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              As métricas abaixo não foram encontradas no CSV. Para análises mais completas,
              considere adicioná-las ao exportar do Gerenciador de Anúncios:
            </p>
            <div className="flex flex-wrap gap-2">
              {dataset.missingMetrics.map((m) => (
                <span
                  key={m}
                  className="text-xs px-2.5 py-1 rounded-md bg-[oklch(0.78_0.16_60_/_0.08)] text-[oklch(0.85_0.16_60)] border border-[oklch(0.78_0.16_60_/_0.2)]"
                >
                  {m}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            Todas as métricas suportadas estão disponíveis.
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-3">💡 Como exportar o CSV ideal</h3>
        <ol className="space-y-2 text-sm text-foreground/85 list-decimal list-inside">
          <li>
            No Gerenciador de Anúncios, acesse a aba <strong>Campanhas</strong> (ou Conjuntos /
            Anúncios).
          </li>
          <li>
            Configure as colunas para incluir: Investimento, Impressões, Alcance, Cliques no link,
            CTR, CPC, CPM, Frequência, Resultados, Compras, Valor de conversão, ROAS.
          </li>
          <li>Selecione o período desejado.</li>
          <li>
            Clique em <strong>Relatórios → Exportar tabela (.csv)</strong>.
          </li>
          <li>Faça upload do arquivo aqui no Dashboard de Ouro.</li>
        </ol>
      </div>
    </div>
  );
}

/* ============ Report Tab (printable) ============ */

function ReportTab({
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
