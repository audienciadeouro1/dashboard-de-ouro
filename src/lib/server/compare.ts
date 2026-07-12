import type { D1Database } from "@cloudflare/workers-types";
import { getClientTotals } from "./metrics";
import { getClientFunnel } from "./funnel";
import type { Range } from "../metrics/compare";
import type { Totals } from "../csv/aggregate";
import type { FunnelResult } from "../metrics/funnel";

export interface ComparisonSide {
  range: Range;
  totals: Totals;
  funnel: FunnelResult | null;
}

export interface ClientComparison {
  a: ComparisonSide;
  b: ComparisonSide;
}

async function sideFor(db: D1Database, clientId: number, range: Range): Promise<ComparisonSide> {
  const [totals, funnel] = await Promise.all([
    getClientTotals(db, clientId, range),
    getClientFunnel(db, clientId, range),
  ]);
  return { range, totals, funnel };
}

export async function getClientComparison(
  db: D1Database,
  clientId: number,
  a: Range,
  b: Range,
): Promise<ClientComparison> {
  const [sideA, sideB] = await Promise.all([
    sideFor(db, clientId, a),
    sideFor(db, clientId, b),
  ]);
  return { a: sideA, b: sideB };
}
