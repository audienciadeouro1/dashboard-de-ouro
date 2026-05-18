import type { CanonicalKey } from "./normalize";

export type AnalysisMode = "sales" | "leads" | "awareness" | "engagement" | "video" | "custom";

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
  // Cópia dos dados originais para não perder nada
  rawData: Record<string, string>;
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
}

export interface ReportConfig {
  clientName: string;
  period: string;
  mode: AnalysisMode;
  customKpis?: CanonicalKey[];
}
