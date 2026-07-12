/**
 * Fórmulas puras de métricas de tráfego — fonte única da verdade.
 * REGRA: divisão por zero retorna 0 (comportamento histórico do sistema;
 * os formatters da UI cuidam da exibição). Nunca NaN/Infinity.
 * Extraído de src/lib/csv/aggregate.ts sem mudança de resultado.
 */

/** Divisão segura: retorna 0 se o denominador não for positivo. */
export const safeDiv = (num: number, den: number): number => (den > 0 ? num / den : 0);

/** CTR em % = cliques no link / impressões × 100 */
export const ctr = (clicks: number, impressions: number): number =>
  safeDiv(clicks, impressions) * 100;

/** CPC em BRL = investimento / cliques no link */
export const cpc = (spend: number, clicks: number): number => safeDiv(spend, clicks);

/** CPM em BRL = investimento / impressões × 1000 */
export const cpm = (spend: number, impressions: number): number =>
  safeDiv(spend, impressions) * 1000;

/** ROAS = valor de conversão / investimento */
export const roas = (conversionValue: number, spend: number): number =>
  safeDiv(conversionValue, spend);

/** CPA em BRL = investimento / compras */
export const cpa = (spend: number, purchases: number): number => safeDiv(spend, purchases);

/** Custo por resultado em BRL */
export const costPerResult = (spend: number, results: number): number =>
  safeDiv(spend, results);

/** Custo por conversa iniciada em BRL */
export const costPerConversation = (spend: number, conversations: number): number =>
  safeDiv(spend, conversations);

/** Custo por ThruPlay em BRL */
export const costPerThruplay = (spend: number, thruplays: number): number =>
  safeDiv(spend, thruplays);

/** Frequência = impressões / alcance */
export const frequency = (impressions: number, reach: number): number =>
  safeDiv(impressions, reach);

/**
 * Ticket médio = valor de conversão / compras.
 * Sem compras, usa o fallback (maior "valor médio de conversão" informado pela Meta), como hoje.
 */
export const ticketMedio = (
  conversionValue: number,
  purchases: number,
  fallback = 0,
): number => (purchases > 0 ? conversionValue / purchases : fallback);
