// Normalização de colunas do CSV do Meta Ads
// Mapeia diferentes nomenclaturas para chaves canônicas

export type CanonicalKey =
  | "campaignName"
  | "adSetName"
  | "adName"
  | "date"
  | "objective"
  | "spend"
  | "impressions"
  | "reach"
  | "frequency"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "results"
  | "resultIndicator"
  | "resultUnit"
  | "costPerResult"
  | "purchases"
  | "cpa"
  | "conversionValue"
  | "roas"
  | "conversations"
  | "videoPlays"
  | "thruplays"
  | "video25"
  | "video50"
  | "video75"
  | "video95"
  | "engagement"
  | "reactions"
  | "comments"
  | "shares";

const COLUMN_MAP: Record<CanonicalKey, string[]> = {
  campaignName: ["campaign name", "nome da campanha", "campanha"],
  adSetName: [
    "ad set name",
    "nome do conjunto de anúncios",
    "nome do conjunto de anuncios",
    "conjunto de anúncios",
    "conjunto de anuncios",
    "adset name",
  ],
  adName: ["ad name", "nome do anúncio", "nome do anuncio", "anúncio", "anuncio", "ad"],
  date: [
    "day",
    "data",
    "dia",
    "date",
    "reporting starts",
    "inicio dos relatorios",
    "inicio do relatorio",
    "data de inicio",
    "start date",
    "reporting starts",
    "reporting starts",
  ],
  objective: ["objective", "objetivo", "objective of the campaign"],
  spend: [
    "amount spent",
    "amount spent (brl)",
    "valor usado",
    "valor usado (brl)",
    "investimento",
    "gasto",
    "valor investido",
    "amount spent (usd)",
    "amount spent (eur)",
    "valor gasto",
  ],
  impressions: ["impressions", "impressões", "impressoes"],
  reach: ["reach", "alcance"],
  frequency: ["frequency", "frequência", "frequencia"],
  clicks: [
    "clicks",
    "link clicks",
    "cliques",
    "cliques no link",
    "cliques (todos)",
    "cliques no link único",
    "unique link clicks",
    "link clicks",
  ],
  ctr: [
    "ctr",
    "ctr (link click-through rate)",
    "ctr (taxa de cliques no link)",
    "ctr único",
    "ctr unico",
    "ctr do link",
    "ctr (todos)",
    "unique ctr (link click-through rate)",
    "ctr",
  ],
  cpc: [
    "cpc",
    "cpc (cost per link click)",
    "custo por clique",
    "custo por clique no link",
    "cpc (custo por clique no link)",
    "unique cpc (cost per link click)",
    "cpc",
  ],
  cpm: [
    "cpm",
    "cpm (cost per 1,000 impressions)",
    "custo por mil impressões",
    "custo por mil impressoes",
    "cpm (custo por mil impressões)",
  ],
  results: ["results", "resultados"],
  resultIndicator: ["result indicator", "indicador de resultados", "indicador de resultado"],
  resultUnit: ["result unit", "unidade de resultados", "unidade de resultado"],
  costPerResult: [
    "cost per result",
    "cost per results",
    "custo por resultado",
    "custo por resultados",
  ],
  purchases: [
    "purchases",
    "website purchases",
    "compras",
    "pedidos",
    "pedidos no site",
    "compras no site",
    "compras no facebook",
    "compras offline",
    "fb_mobile_purchase",
    "compras no aplicativo",
    "compras (todos)",
    "compras",
  ],
  cpa: [
    "cost per purchase",
    "custo por compra",
    "cpa",
    "custo por aquisição",
    "custo por aquisicao",
    "custo por pedido",
    "cost per website purchase",
  ],
  conversionValue: [
    "purchase conversion value",
    "website purchase conversion value",
    "valor de conversão",
    "valor de conversao",
    "valor de conversão da compra",
    "receita",
    "valor de conversões da compra",
    "valor de conversao de compras",
    "valor de conversão de compras no site",
    "valor de conversão de compras no facebook",
    "total purchase conversion value",
    "valor de conversão de resultados",
    "valor de conversao de resultados",
    "result conversion value",
    "valor de conversao",
    "valor de conversão",
    "valor total de conversao de compras",
    "valor total de conversao",
    "valor de conversao de compras no site",
    "valor de conversao de compras (facebook pixel)",
    "valor de conversao de compras no site",
    "valor de conversao de compras (fb pixel)",
    "valor de conversao de compras offline",
    "faturamento",
  ],
  roas: [
    "roas",
    "purchase roas",
    "website purchase roas",
    "retorno sobre investimento em anúncios",
    "retorno sobre o investimento em publicidade (roas) das compras",
    "roas da compra",
    "purchase roas (return on ad spend)",
    "roas",
  ],
  conversations: [
    "messaging conversations started",
    "conversas iniciadas",
    "conversas no whatsapp iniciadas",
    "conversas iniciadas por mensagem",
    "novas conversas por mensagem",
    "conversas",
    "new messaging conversations",
  ],
  costPerConversation: [
    "cost per messaging conversation started",
    "custo por conversa iniciada",
    "custo por conversa",
    "custo por novas conversas por mensagem",
  ],
  videoPlays: [
    "video plays",
    "reproduções de vídeo",
    "reproducoes de video",
    "reproduções do vídeo",
    "video views",
  ],
  thruplays: [
    "thruplay",
    "thruplays",
    "reproduções do vídeo até o fim",
    "thruplays (reproduções do vídeo até o fim)",
  ],
  video25: [
    "video plays at 25%",
    "video watches at 25%",
    "reproduções de vídeo em 25%",
    "visualizações 25%",
    "reproduções do vídeo em 25%",
    "video 25%",
  ],
  video50: [
    "video plays at 50%",
    "video watches at 50%",
    "reproduções de vídeo em 50%",
    "visualizações 50%",
    "reproduções do vídeo em 50%",
    "video 50%",
  ],
  video75: [
    "video plays at 75%",
    "video watches at 75%",
    "reproduções de vídeo em 75%",
    "visualizações 75%",
    "reproduções do vídeo em 75%",
    "video 75%",
  ],
  video95: [
    "video plays at 95%",
    "video watches at 95%",
    "reproduções de vídeo em 95%",
    "visualizações 95%",
    "reproduções do vídeo em 95%",
    "video 95%",
  ],
  engagement: [
    "post engagement",
    "page engagement",
    "engajamento da publicação",
    "engajamento da página",
    "engajamentos",
    "interações com a publicação",
  ],
  reactions: [
    "post reactions",
    "reações da publicação",
    "reacoes da publicacao",
    "curtidas",
    "reactions",
  ],
  comments: ["post comments", "comentários da publicação", "comentarios", "comments"],
  shares: ["post shares", "compartilhamentos da publicação", "compartilhamentos", "shares"],
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[.*?\]/g, "") // Strip attribution windows like [28 days...]
    .replace(/\s+/g, " ")
    .trim();

export function buildColumnIndex(headers: string[]): {
  index: Partial<Record<CanonicalKey, string>>;
  recognized: string[];
  unrecognized: string[];
} {
  const index: Partial<Record<CanonicalKey, string>> = {};
  const recognized: string[] = [];
  const unrecognized: string[] = [];

  const normalizedHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));

  for (const header of normalizedHeaders) {
    let matched = false;
    for (const [key, aliases] of Object.entries(COLUMN_MAP) as [CanonicalKey, string[]][]) {
      if (index[key]) continue;
      if (aliases.some((a) => norm(a) === header.n)) {
        index[key] = header.raw;
        recognized.push(header.raw);
        matched = true;
        break;
      }
    }
    if (!matched) unrecognized.push(header.raw);
  }

  return { index, recognized, unrecognized };
}

// Converte string para número, lidando com R$, vírgulas, %, etc.
export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s || s === "-" || s.toLowerCase() === "n/a") return 0;
  s = s.replace(/r\$/gi, "").replace(/%/g, "").replace(/\s/g, "");
  // Trata formato BR (1.234,56) vs US (1,234.56)
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Se ambos, presume BR: ponto = milhar, vírgula = decimal
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
