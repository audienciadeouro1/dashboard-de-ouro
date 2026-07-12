import type { D1Database } from "@cloudflare/workers-types";
import { getClientTotals, type MetricsRange } from "./metrics";
import { getCommercialPeriods } from "./commercial";
import { getFunnelConfig } from "./funnel-config";
import { parseBRNumber } from "../csv/commercial";
import { deriveFunnel, type FunnelStage, type FunnelResult } from "../metrics/funnel";
import type { Totals } from "../csv/aggregate";

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
};

export async function getClientFunnel(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<FunnelResult | null> {
  const config = await getFunnelConfig(db, clientId);
  if (!config) return null;

  const totals = await getClientTotals(db, clientId, range);
  const periods = (await getCommercialPeriods(db, clientId)).filter((p) =>
    periodOverlaps(p.startDate, p.endDate, range),
  );

  const stages: FunnelStage[] = [];
  for (const ms of config.metaStages) {
    const field = META_FIELD[ms.key];
    const count = field ? Number(totals[field] ?? 0) : 0;
    stages.push({ key: ms.key, label: ms.label, source: "meta", count });
  }
  for (const cs of config.commercial.stages) {
    let count = 0;
    for (const p of periods) count += parseBRNumber(p.row[cs.column]);
    stages.push({ key: cs.key, label: cs.label, source: "commercial", count });
  }

  let revenue = 0;
  for (const p of periods) revenue += parseBRNumber(p.row[config.commercial.revenueColumn]);

  return deriveFunnel(stages, totals.spend, revenue);
}
