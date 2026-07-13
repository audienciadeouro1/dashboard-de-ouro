import type { AdRow } from "../csv/types";
import type { DashboardProfile } from "../server/clients";

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

// Campos pedidos à Graph API (nível de anúncio, time_increment=1).
export const META_INSIGHT_FIELDS = [
  "campaign_name",
  "adset_name",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
];

// Tipos de ação que contam como Compra (pixel padrão do Aki Sushi).
export const PURCHASE_ACTIONS = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
];
// Conversa iniciada por mensagem (WhatsApp — Maria Maria).
export const WHATSAPP_CONVERSATION_ACTION = "onsite_conversion.messaging_conversation_started_7d";

export function resultKindForProfile(profile: DashboardProfile): "purchases" | "conversations" {
  return profile === "leads" || profile === "maria-maria" ? "conversations" : "purchases";
}

function num(v?: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function sumActions(list: MetaAction[] | undefined, types: string[]): number {
  if (!list) return 0;
  return list.reduce((acc, a) => (types.includes(a.action_type) ? acc + num(a.value) : acc), 0);
}

export function metaInsightToAdRow(raw: MetaInsightRow, profile: DashboardProfile): AdRow {
  const spend = num(raw.spend);
  const purchases = sumActions(raw.actions, PURCHASE_ACTIONS);
  const conversionValue = sumActions(raw.action_values, PURCHASE_ACTIONS);
  const conversations = sumActions(raw.actions, [WHATSAPP_CONVERSATION_ACTION]);
  const kind = resultKindForProfile(profile);
  const results = kind === "conversations" ? conversations : purchases;

  // rawData preserva os campos escalares originais para a tela (nada se perde).
  const rawData: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") rawData[k] = v;
  }
  rawData["Origem"] = "Meta API";

  return {
    campaignName: raw.campaign_name ?? "",
    adSetName: raw.adset_name ?? "",
    adName: raw.ad_name ?? "",
    date: raw.date_start,
    endDate: raw.date_stop,
    objective: "",
    delivery: "",
    budget: 0,
    budgetType: "",
    attribution: "",
    spend,
    impressions: num(raw.impressions),
    reach: num(raw.reach),
    frequency: num(raw.frequency),
    clicks: num(raw.clicks),
    ctr: num(raw.ctr),
    cpc: num(raw.cpc),
    cpm: num(raw.cpm),
    results,
    resultIndicator: kind === "conversations" ? "Conversas iniciadas" : "Compras",
    resultUnit: "",
    costPerResult: results > 0 ? spend / results : 0,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
    conversionValue,
    averageConversionValue: purchases > 0 ? conversionValue / purchases : 0,
    roas: spend > 0 ? conversionValue / spend : 0,
    conversations,
    costPerConversation: conversations > 0 ? spend / conversations : 0,
    videoPlays: 0,
    thruplays: 0,
    video25: 0,
    video50: 0,
    video75: 0,
    video95: 0,
    engagement: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    viewContent: 0,
    addToCart: 0,
    initiateCheckout: 0,
    ctrTodos: 0,
    rawData,
  };
}
