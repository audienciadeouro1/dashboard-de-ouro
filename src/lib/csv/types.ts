import type { CanonicalKey } from "./normalize";

export type AnalysisMode =
  | "sales"
  | "leads"
  | "awareness"
  | "engagement"
  | "video"
  | "custom"
  | "maria-maria";

export const ANALYSIS_MODES: {
  id: AnalysisMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "sales",
    label: "Vendas / E-commerce",
    description: "Vendas, pedidos, delivery e e-commerce",
    icon: "shopping-cart",
  },
  {
    id: "leads",
    label: "Conversas / Leads",
    description: "WhatsApp, leads e agendamentos",
    icon: "message-circle",
  },
  {
    id: "awareness",
    label: "Alcance / Reconhecimento",
    description: "Restaurante, marca, presença local",
    icon: "radio",
  },
  {
    id: "engagement",
    label: "Engajamento",
    description: "Curtidas, comentários e interações",
    icon: "heart",
  },
  { id: "video", label: "Vídeo", description: "Visualizações e retenção de vídeo", icon: "play" },
  {
    id: "custom",
    label: "Personalizado",
    description: "Selecione manualmente suas métricas",
    icon: "sliders",
  },
  {
    id: "maria-maria",
    label: "Maria Maria (Salão)",
    description: "Preset avançado com upload duplo (Meta + Salão)",
    icon: "sparkles",
  },
];

export interface AdRow {
  campaignName: string;
  adSetName: string;
  adName: string;
  date: string;
  endDate: string;
  objective: string;
  delivery: string;
  budget: number;
  budgetType: string;
  attribution: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  results: number;
  resultIndicator: string;
  resultUnit: string;
  costPerResult: number;
  purchases: number;
  cpa: number;
  conversionValue: number;
  averageConversionValue: number;
  roas: number;
  conversations: number;
  costPerConversation: number;
  videoPlays: number;
  thruplays: number;
  video25: number;
  video50: number;
  video75: number;
  video95: number;
  engagement: number;
  reactions: number;
  comments: number;
  shares: number;
  // Métricas técnicas adicionais para Maria Maria
  ctrTodos: number;
  // Cópia dos dados originais para não perder nada
  rawData: Record<string, string>;
}

export interface MariaMariaRow {
  semana: string;
  startDate: number;
  endDate: number;
  salonData: {
    contatosWhatsapp: number;
    agendamentos: number;
    agendamentosComServico: number;
    totalFaturamento: number;
    ticketMedio: number;
  };
  metaData: {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number;
    ctr: number;
    ctrTodos: number;
    cpm: number;
    conversations: number;
    cpl: number;
    clicks: number;
  };
  roasReal: number;
  cacReal: number;
  taxaConversaoReal: number;
}

export interface MariaMariaDataset {
  weeks: MariaMariaRow[];
  metaDataset: ParsedDataset;
}

export interface ParsedDataset {
  fileName: string;
  rows: AdRow[];
  totalRows: number;
  totalColumns: number;
  recognizedColumns: string[];
  unrecognizedColumns: string[];
  availableMetrics: CanonicalKey[];
  missingMetrics: CanonicalKey[];
  hasDate: boolean;
  hasCampaign: boolean;
  hasAdSet: boolean;
  hasAd: boolean;
  mariaMaria?: MariaMariaDataset;
}

export interface ReportConfig {
  clientName: string;
  period: string;
  mode: AnalysisMode;
  customKpis?: CanonicalKey[];
}

// Fase 2A — configuração de funil por cliente (etapas Meta + comerciais + mapeamento)
export interface FunnelStageMeta {
  key: string;
  label: string;
}
export interface FunnelStageCommercial {
  key: string;
  label: string;
  column: string;
}
export interface FunnelConfig {
  metaStages: FunnelStageMeta[];
  commercial: {
    periodColumn: string;
    revenueColumn: string;
    ticketColumn?: string;
    stages: FunnelStageCommercial[];
  };
}
