import type { D1Database } from "@cloudflare/workers-types";
import { getClientTotals, type MetricsRange } from "./metrics";
import { getInsights } from "./insights";
import { getCommercialPeriods } from "./commercial";
import { getFunnelConfig } from "./funnel-config";
import { parseBRNumber } from "../csv/commercial";
import { deriveFunnel, type FunnelStage, type FunnelResult } from "../metrics/funnel";
import type { Totals } from "../csv/aggregate";
import type { AdRow } from "../csv/types";

export function periodOverlaps(pStart: string, pEnd: string, range?: MetricsRange): boolean {
  if (!range || (!range.start && !range.end)) return true;
  const rStart = range.start ?? "0000-01-01";
  const rEnd = range.end ?? "9999-12-31";
  return pStart <= rEnd && pEnd >= rStart;
}

const META_FIELD: Record<string, keyof Totals> = {
  impressions: "impressions",
  clicks: "clicks",
  conversations: "conversations",
  reach: "reach",
  purchases: "purchases",
  conversionValue: "conversionValue",
};

/** Soma uma coluna crua do CSV (de AdRow.rawData) sobre as linhas do período. */
function sumRawColumn(rows: AdRow[], column: string): number {
  let total = 0;
  for (const r of rows) total += parseBRNumber(r.rawData?.[column]);
  return total;
}

export async function getClientFunnel(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<FunnelResult | null> {
  const config = await getFunnelConfig(db, clientId);
  if (!config) return null;

  const totals = await getClientTotals(db, clientId, range);
  // Linhas cruas usadas para etapas de pixel (colunas não tipadas).
  const needsRaw = config.metaStages.some((s) => s.column);
  const rows = needsRaw ? await getInsights(db, clientId, range) : [];

  const stages: FunnelStage[] = [];
  for (const ms of config.metaStages) {
    let count = 0;
    if (ms.column) {
      count = sumRawColumn(rows, ms.column);
    } else {
      const field = META_FIELD[ms.key];
      count = field ? Number(totals[field] ?? 0) : 0;
    }
    stages.push({ key: ms.key, label: ms.label, source: "meta", count });
  }

  // Etapas e faturamento comerciais (quando o cliente tem CSV comercial).
  let revenue = 0;
  if (config.commercial) {
    const periods = (await getCommercialPeriods(db, clientId)).filter((p) =>
      periodOverlaps(p.startDate, p.endDate, range),
    );
    for (const cs of config.commercial.stages) {
      let count = 0;
      for (const p of periods) count += parseBRNumber(p.row[cs.column]);
      stages.push({ key: cs.key, label: cs.label, source: "commercial", count });
    }
    for (const p of periods) revenue += parseBRNumber(p.row[config.commercial.revenueColumn]);
  } else if (config.metaRevenueKey) {
    const field = META_FIELD[config.metaRevenueKey];
    revenue = field ? Number(totals[field] ?? 0) : 0;
  }

  return deriveFunnel(stages, totals.spend, revenue);
}
