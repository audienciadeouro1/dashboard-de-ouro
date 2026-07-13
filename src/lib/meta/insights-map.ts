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
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
  "purchase_roas",
  "cost_per_action_type",
];

// FONTE CANÔNICA ÚNICA por métrica. A Meta retorna o MESMO evento em várias
// superfícies (ex.: purchase, omni_purchase, offsite_conversion.fb_pixel_purchase);
// SOMAR duplicaria. Usar sempre um único action_type por métrica.
export const CANONICAL_ACTIONS = {
  purchase: "purchase",
  viewContent: "view_content",
  addToCart: "add_to_cart",
  initiateCheckout: "initiate_checkout",
  // Conversa iniciada por mensagem (WhatsApp — Maria Maria).
  conversation: "onsite_conversion.messaging_conversation_started_7d",
} as const;

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
  // Fonte canônica única (nunca somar superfícies do mesmo evento).
  const purchases = sumActions(raw.actions, [CANONICAL_ACTIONS.purchase]);
  const conversionValue = sumActions(raw.action_values, [CANONICAL_ACTIONS.purchase]);
  const conversations = sumActions(raw.actions, [CANONICAL_ACTIONS.conversation]);
  const viewContent = sumActions(raw.actions, [CANONICAL_ACTIONS.viewContent]);
  const addToCart = sumActions(raw.actions, [CANONICAL_ACTIONS.addToCart]);
  const initiateCheckout = sumActions(raw.actions, [CANONICAL_ACTIONS.initiateCheckout]);
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
    viewContent,
    addToCart,
    initiateCheckout,
    ctrTodos: 0,
    rawData,
  };
}
