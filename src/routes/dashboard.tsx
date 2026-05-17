import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { getData, subscribe, setConfig } from "@/lib/store";
import { aggregate, timeSeries, totals as computeTotals } from "@/lib/csv/aggregate";
import { diagnoseCampaigns, diagnoseAccount } from "@/lib/csv/diagnostics";
import { fmtBRL, fmtNum, fmtPct, fmtCompact } from "@/lib/csv/format";
import type { AdRow, AnalysisMode } from "@/lib/csv/types";
import type { CanonicalKey } from "@/lib/csv/normalize";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Check, ChevronRight, PlusCircle, Hash } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dashboard de Ouro" },
      { name: "description", content: "Análise visual de campanhas Meta Ads." },
    ],
  }),
  component: DashboardPage,
});

const GOLD = "oklch(0.83 0.16 88)";
const GOLD_BRIGHT = "oklch(0.88 0.18 92)";
const GOLD_DARK = "oklch(0.6 0.13 75)";
const SUCCESS = "oklch(0.72 0.18 150)";
const DANGER = "oklch(0.65 0.22 25)";
const WARNING = "oklch(0.78 0.16 60)";
const PALETTE = [GOLD_BRIGHT, GOLD, GOLD_DARK, WARNING, SUCCESS, DANGER];

const METRIC_CONFIGS: Record<
  CanonicalKey,
  { label: string; icon: React.ReactNode; formatter: (v: number) => string }
> = {
  spend: { label: "Investimento", icon: <DollarSign className="w-4 h-4" />, formatter: fmtBRL },
  impressions: { label: "Impressões", icon: <Eye className="w-4 h-4" />, formatter: fmtCompact },
  reach: { label: "Alcance", icon: <Users className="w-4 h-4" />, formatter: fmtCompact },
  frequency: {
    label: "Frequência",
    icon: <Repeat className="w-4 h-4" />,
    formatter: (v) => `${fmtNum(v, 2)}x`,
  },
  clicks: {
    label: "Cliques no link",
    icon: <MousePointerClick className="w-4 h-4" />,
    formatter: fmtNum,
  },
  ctr: { label: "CTR", icon: <TrendingUp className="w-4 h-4" />, formatter: fmtPct },
  cpc: { label: "CPC", icon: <DollarSign className="w-4 h-4" />, formatter: fmtBRL },
  cpm: { label: "CPM", icon: <Target className="w-4 h-4" />, formatter: fmtBRL },
  results: { label: "Resultados", icon: <Target className="w-4 h-4" />, formatter: fmtNum },
  purchases: { label: "Compras", icon: <ShoppingBag className="w-4 h-4" />, formatter: fmtNum },
  cpa: { label: "CPA", icon: <Target className="w-4 h-4" />, formatter: fmtBRL },
  conversionValue: {
    label: "Faturamento",
    icon: <TrendingUp className="w-4 h-4" />,
    formatter: fmtBRL,
  },
  roas: {
    label: "ROAS",
    icon: <Award className="w-4 h-4" />,
    formatter: (v) => `${fmtNum(v, 2)}x`,
  },
  conversations: {
    label: "Conversas",
    icon: <MessageCircle className="w-4 h-4" />,
    formatter: fmtNum,
  },
  costPerConversation: {
    label: "Custo por conversa",
    icon: <Target className="w-4 h-4" />,
    formatter: fmtBRL,
  },
  videoPlays: {
    label: "Reproduções de vídeo",
    icon: <Play className="w-4 h-4" />,
    formatter: fmtNum,
  },
  thruplays: { label: "ThruPlays", icon: <Award className="w-4 h-4" />, formatter: fmtNum },
  video25: { label: "Vídeo 25%", icon: <Play className="w-4 h-4" />, formatter: fmtNum },
  video50: { label: "Vídeo 50%", icon: <Play className="w-4 h-4" />, formatter: fmtNum },
  video75: { label: "Vídeo 75%", icon: <Play className="w-4 h-4" />, formatter: fmtNum },
  video95: { label: "Vídeo 95%", icon: <Play className="w-4 h-4" />, formatter: fmtNum },
  engagement: { label: "Engajamento", icon: <Heart className="w-4 h-4" />, formatter: fmtNum },
  reactions: { label: "Reações", icon: <Heart className="w-4 h-4" />, formatter: fmtNum },
  comments: {
    label: "Comentários",
    icon: <MessageCircle className="w-4 h-4" />,
    formatter: fmtNum,
  },
  shares: { label: "Compartilhamentos", icon: <Repeat className="w-4 h-4" />, formatter: fmtNum },
  resultIndicator: {
    label: "Indicador",
    icon: <Hash className="w-4 h-4" />,
    formatter: (v) => String(v),
  },
  resultUnit: { label: "Unidade", icon: <Hash className="w-4 h-4" />, formatter: (v) => String(v) },
  costPerResult: {
    label: "Custo / Resultado",
    icon: <Target className="w-4 h-4" />,
    formatter: fmtBRL,
  },
  campaignName: { label: "Nome", icon: <Hash className="w-4 h-4" />, formatter: (v) => String(v) },
  adSetName: { label: "Conjunto", icon: <Hash className="w-4 h-4" />, formatter: (v) => String(v) },
  adName: { label: "Anúncio", icon: <Hash className="w-4 h-4" />, formatter: (v) => String(v) },
  date: { label: "Data", icon: <Hash className="w-4 h-4" />, formatter: (v) => String(v) },
  objective: { label: "Objetivo", icon: <Hash className="w-4 h-4" />, formatter: (v) => String(v) },
};

function useStore() {
  return useSyncExternalStore(
    subscribe,
    () => getData(),
    () => getData(),
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { dataset, config } = useStore();

  useEffect(() => {
    if (!dataset || !config) {
      navigate({ to: "/" });
    }
  }, [dataset, config, navigate]);

  return <DashboardContent />;
}

function DashboardContent() {
  const { dataset, config } = useStore();

  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [adSetFilter, setAdSetFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");

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
  }, [dataset, campaignFilter, adSetFilter, search]);

  const totals = useMemo(() => computeTotals(filteredRows), [filteredRows]);
  const byCampaign = useMemo(() => aggregate(filteredRows, "campaignName"), [filteredRows]);
  const byAdSet = useMemo(() => aggregate(filteredRows, "adSetName"), [filteredRows]);
  const byAd = useMemo(() => aggregate(filteredRows, "adName"), [filteredRows]);
  const series = useMemo(() => timeSeries(filteredRows), [filteredRows]);
  const diagnosed = useMemo(
    () => diagnoseCampaigns(byCampaign, totals, config?.mode || "sales"),
    [byCampaign, totals, config?.mode],
  );
  const accountDx = useMemo(
    () => diagnoseAccount(totals, diagnosed, config?.mode || "sales"),
    [totals, diagnosed, config?.mode],
  );

  if (!dataset || !config) return null;

  return (
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
              <Printer className="w-4 h-4 mr-1.5" /> Imprimir
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-[oklch(0.83_0.16_88_/_0.3)] hover:border-[oklch(0.83_0.16_88_/_0.6)]"
            >
              <Link to="/">
                <RefreshCw className="w-4 h-4 mr-1.5" /> Trocar arquivo
              </Link>
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
              <ArrowLeft className="w-3 h-3 mr-1" /> Voltar ao upload
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
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha, conjunto ou anúncio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]"
            />
          </div>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[220px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
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
              <SelectTrigger className="w-[220px] bg-[oklch(0.16_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
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
          <TabsList className="bg-[oklch(0.14_0_0)] border border-[oklch(0.83_0.16_88_/_0.15)] p-1 h-auto flex-wrap no-print">
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
                className="data-[state=active]:bg-[oklch(0.83_0.16_88_/_0.15)] data-[state=active]:text-[oklch(0.88_0.18_92)] text-xs md:text-sm"
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
              mode={config.mode}
              hasDate={dataset.hasDate}
            />
          </TabsContent>
          <TabsContent value="campaigns">
            <CampaignsTab diagnosed={diagnosed} mode={config.mode} />
          </TabsContent>
          <TabsContent value="adsets">
            <AggregatedTab
              data={byAdSet}
              mode={config.mode}
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
              mode={config.mode}
              totals={totals}
            />
          </TabsContent>
          <TabsContent value="diagnosis">
            <DiagnosisTab dx={accountDx} diagnosed={diagnosed} mode={config.mode} />
          </TabsContent>
          <TabsContent value="data">
            <DataQualityTab />
          </TabsContent>
          <TabsContent value="report">
            <ReportTab
              totals={totals}
              diagnosed={diagnosed}
              dx={accountDx}
              mode={config.mode}
              series={series}
              hasDate={dataset.hasDate}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ============ KPI definitions per mode ============ */

import type { Totals } from "@/lib/csv/aggregate";
import type { AnalysisMode } from "@/lib/csv/types";
import type { DiagnosedCampaign, AccountDiagnosis } from "@/lib/csv/diagnostics";

interface KpiDef {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  key?: CanonicalKey;
}

function getKpis(totals: Totals, mode: AnalysisMode, customKpis: CanonicalKey[] = []): KpiDef[] {
  const base: KpiDef[] = [
    {
      label: "Investimento",
      value: fmtBRL(totals.spend),
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
          value: fmtBRL(totals.conversionValue),
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
          value: fmtBRL(totals.cpa),
          icon: <Target className="w-4 h-4" />,
          key: "cpa",
        },
        {
          label: "Ticket médio",
          value: fmtBRL(totals.ticketMedio),
          icon: <DollarSign className="w-4 h-4" />,
        },
        {
          label: "CPC",
          value: fmtBRL(totals.cpc),
          icon: <MousePointerClick className="w-4 h-4" />,
          key: "cpc",
        },
        {
          label: "CTR",
          value: fmtPct(totals.ctr),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
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
          value: fmtBRL(totals.costPerConversation),
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
          value: fmtBRL(totals.cpc),
          icon: <DollarSign className="w-4 h-4" />,
          key: "cpc",
        },
        {
          label: "Alcance",
          value: fmtCompact(totals.reach),
          icon: <Users className="w-4 h-4" />,
          key: "reach",
        },
        { label: "CPM", value: fmtBRL(totals.cpm), icon: <Eye className="w-4 h-4" />, key: "cpm" },
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
          value: fmtBRL(totals.cpm),
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
          value: fmtBRL(totals.spend / Math.max(1, totals.engagement || totals.clicks)),
          icon: <Target className="w-4 h-4" />,
        },
        {
          label: "CTR",
          value: fmtPct(totals.ctr),
          icon: <TrendingUp className="w-4 h-4" />,
          key: "ctr",
        },
        { label: "CPM", value: fmtBRL(totals.cpm), icon: <Eye className="w-4 h-4" />, key: "cpm" },
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
      const val = (totals as unknown as Record<string, number>)[k] || 0;
      finalKpis.push({
        label: conf.label,
        value: conf.formatter(val),
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
}

function OverviewTab({ totals, series, diagnosed, mode, hasDate }: OverviewProps) {
  const { config, dataset } = useStore();
  const kpis = getKpis(totals, mode, config?.customKpis);

  const best = [...diagnosed].sort((a, b) => {
    if (mode === "sales") return b.roas - a.roas;
    return b.spend / Math.max(1, a.spend) - 1;
  })[0];
  const biggest = [...diagnosed].sort((a, b) => b.spend - a.spend)[0];
  const scaleOpp = diagnosed.find((c) => c.status === "scale");
  const warning = diagnosed.find((c) => c.status === "pause" || c.status === "optimize");

  // Exibe todas as métricas suportadas que ainda não estão na tela e que tenham valores numéricos
  const availableMetrics = (Object.keys(METRIC_CONFIGS) as CanonicalKey[]).filter((m) => {
    // Não mostra se já estiver nos KPIs fixos do modo
    if (kpis.some((k) => k.key === m)) return false;
    // Não mostra métricas não-numéricas para cards
    if (
      [
        "campaignName",
        "adSetName",
        "adName",
        "date",
        "objective",
        "resultIndicator",
        "resultUnit",
      ].includes(m)
    )
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
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

      {/* Time series + highlights */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold">Evolução do investimento</h3>
              <p className="text-xs text-muted-foreground">
                {hasDate
                  ? "Investimento e resultados ao longo do tempo"
                  : "Sem coluna de data no CSV"}
              </p>
            </div>
          </div>
          {hasDate && series.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                <XAxis
                  dataKey="date"
                  stroke="oklch(0.6 0 0)"
                  fontSize={10}
                  tickFormatter={(v) => v.split("/").slice(0, 2).join("/")} // Simplifica DD/MM
                />
                <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip content={<GoldTooltip formatter={(v) => fmtBRL(v)} />} />
                <Area
                  type="monotone"
                  dataKey="spend"
                  name="Investimento"
                  stroke={GOLD}
                  fill="url(#goldFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Dados insuficientes para série temporal" />
          )}
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
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
    if (mode === "sales") return { label: "Compras", value: fmtNum(c.purchases || c.results) };
    if (mode === "leads")
      return { label: "Conversas", value: fmtNum(c.conversations || c.results) };
    if (mode === "video") return { label: "ThruPlays", value: fmtNum(c.thruplays) };
    if (mode === "awareness") return { label: "Alcance", value: fmtCompact(c.reach) };
    return { label: "Resultados", value: fmtNum(c.results || c.clicks) };
  };
  const primaryCost = (c: DiagnosedCampaign) => {
    if (mode === "sales") return fmtBRL(c.cpa || c.costPerResult);
    if (mode === "leads") return fmtBRL(c.costPerConversation || c.costPerResult);
    if (mode === "video") return fmtBRL(c.costPerThruplay);
    return fmtBRL(c.costPerResult || c.cpc);
  };

  return (
    <div className="space-y-6">
      {/* Comparison chart */}
      <div className="glass-card rounded-xl p-6">
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

import type { Aggregated } from "@/lib/csv/aggregate";

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
                <th className="px-3 py-3 font-medium text-right">Freq.</th>
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
                  <td className="px-3 py-3 text-right tabular-nums">
                    {fmtNum(c.results || c.purchases || c.conversations || c.thruplays)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(primaryCost(c))}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpc)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(c.cpm)}</td>
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
  const top = [...byCampaign].sort((a, b) => b.spend - a.spend).slice(0, 6);

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

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {hasDate && series.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Cliques x Impressões por dia</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series}>
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
              <Tooltip content={<GoldTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="clicks"
                name="Cliques"
                stroke={GOLD_BRIGHT}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="impressions"
                name="Impressões"
                stroke={GOLD_DARK}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card rounded-xl p-6">
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
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Funil de retenção de vídeo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={videoFunnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
              <XAxis dataKey="name" stroke="oklch(0.6 0 0)" fontSize={11} />
              <YAxis stroke="oklch(0.6 0 0)" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
              <Tooltip content={<GoldTooltip />} cursor={{ fill: "oklch(0.83 0.16 88 / 0.05)" }} />
              <Bar dataKey="value" name="Visualizações" fill={GOLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
        <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center text-center">
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

        <div className="lg:col-span-2 glass-card rounded-xl p-6">
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
  const { dataset } = useStore();
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
  const { config } = useStore();
  const kpis = getKpis(totals, mode).slice(0, 6);
  const top = [...diagnosed].sort((a, b) => b.spend - a.spend).slice(0, 5);

  return (
    <div className="bg-[oklch(0.13_0_0)] print:bg-white rounded-2xl p-8 md:p-12 print:p-6 print:text-black">
      <div className="flex items-end justify-between flex-wrap gap-4 pb-6 border-b border-[oklch(0.83_0.16_88_/_0.2)] print:border-black/20">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[oklch(0.83_0.16_88)] mb-2">
            Relatório de Performance
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold print:text-black">
            {config?.clientName || "Análise de Campanhas"}
          </h1>
          {config?.period && (
            <p className="text-sm text-muted-foreground mt-1 print:text-gray-700">
              Período: {config.period}
            </p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground print:text-gray-600">
          <div className="font-display text-xl gold-text print:text-black print:font-bold">
            Audiência de Ouro
          </div>
          <div>Relatório gerado pelo Dashboard de Ouro</div>
        </div>
      </div>

      <section className="mt-8 print-page">
        <h2 className="font-display text-xl font-semibold mb-4 print:text-black">
          Resumo executivo
        </h2>
        <p className="text-sm leading-relaxed text-foreground/85 print:text-black">{dx.summary}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-[oklch(0.83_0.16_88_/_0.2)] print:border-black/20 p-4"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground print:text-gray-600">
                {k.label}
              </div>
              <div className="font-display text-2xl font-bold gold-text print:text-black mt-1">
                {k.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {hasDate && series.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-4 print:text-black">
            Evolução do investimento
          </h2>
          <ResponsiveContainer width="100%" height={220}>
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
        </section>
      )}

      <section className="mt-8 print-page">
        <h2 className="font-display text-xl font-semibold mb-4 print:text-black">Top campanhas</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[oklch(0.83_0.16_88_/_0.2)] print:border-black/20 text-xs uppercase tracking-wider text-muted-foreground print:text-gray-600">
              <th className="py-2">Campanha</th>
              <th className="py-2 text-right">Investimento</th>
              <th className="py-2 text-right">CTR</th>
              {mode === "sales" && <th className="py-2 text-right">ROAS</th>}
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c) => (
              <tr
                key={c.key}
                className="border-b border-[oklch(0.83_0.16_88_/_0.08)] print:border-black/10"
              >
                <td className="py-2.5">{c.key}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtBRL(c.spend)}</td>
                <td className="py-2.5 text-right tabular-nums">{fmtPct(c.ctr)}</td>
                {mode === "sales" && (
                  <td className="py-2.5 text-right tabular-nums">
                    {c.roas > 0 ? `${fmtNum(c.roas, 2)}x` : "—"}
                  </td>
                )}
                <td className="py-2.5">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-display text-xl font-semibold mb-3 print:text-black">
            Principais aprendizados
          </h2>
          <ul className="space-y-2 text-sm">
            {[...dx.strengths, ...dx.opportunities].slice(0, 5).map((s, i) => (
              <li key={i} className="flex gap-2 print:text-black">
                <span className="text-[oklch(0.83_0.16_88)] print:text-black">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold mb-3 print:text-black">
            Próximos passos
          </h2>
          <ul className="space-y-2 text-sm">
            {dx.warnings.length > 0 ? (
              dx.warnings.slice(0, 5).map((s, i) => (
                <li key={i} className="flex gap-2 print:text-black">
                  <span className="text-[oklch(0.83_0.16_88)] print:text-black">→</span>
                  {s}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground print:text-gray-600">
                Manter monitoramento da performance atual.
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="mt-10 pt-6 border-t border-[oklch(0.83_0.16_88_/_0.2)] print:border-black/20 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-muted-foreground print:text-gray-600">
          Relatório gerado por{" "}
          <strong className="text-[oklch(0.83_0.16_88)] print:text-black">Audiência de Ouro</strong>
        </div>
        <Button
          onClick={() => window.print()}
          className="gold-gradient text-black font-semibold no-print"
        >
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>
    </div>
  );
}
