import type { D1Database } from "@cloudflare/workers-types";
import { getInsights } from "./insights";
import { totals, timeSeries, type Totals } from "../csv/aggregate";

export interface MetricsRange {
  start?: string; // YYYY-MM-DD (America/Sao_Paulo)
  end?: string; // YYYY-MM-DD
}

/** Totais determinísticos calculados no servidor a partir do D1. */
export async function getClientTotals(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<Totals> {
  const rows = await getInsights(db, clientId, range);
  return totals(rows);
}

/** Série diária determinística calculada no servidor a partir do D1. */
export async function getClientTimeSeries(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<ReturnType<typeof timeSeries>> {
  const rows = await getInsights(db, clientId, range);
  return timeSeries(rows);
}
