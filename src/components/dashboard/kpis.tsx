import {
  Award,
  DollarSign,
  Eye,
  Heart,
  MessageCircle,
  MousePointerClick,
  Play,
  Repeat,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Aggregated, Totals } from "@/lib/csv/aggregate";
import { fmtBRL, fmtBRLNoCents, fmtCompact, fmtNum, fmtPct } from "@/lib/csv/format";
import type { AnalysisMode } from "@/lib/csv/types";
import type { CanonicalKey } from "@/lib/csv/normalize";
import { METRIC_CONFIGS } from "./metric-configs";

export interface KpiDef {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
  key?: CanonicalKey;
}

export function getKpis(
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
      const stringVal = (byCampaign[0] as unknown as Record<string, string> | undefined)?.[k];

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
