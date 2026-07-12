import type { D1Database } from "@cloudflare/workers-types";
import { getClientTotals, type MetricsRange } from "./metrics";
import { computeQuality } from "./quality";
import { listGoals } from "./goals";
import { getClientComparison } from "./compare";
import { precedingRange, type Range } from "../metrics/compare";
import { evaluateDiagnostics, type Alert, type Diagnostic } from "../metrics/diagnostics";

export interface ClientDiagnostics {
  goals: Awaited<ReturnType<typeof listGoals>>;
  diagnostics: Diagnostic[];
  alerts: Alert[];
  period: { start: string | null; end: string | null };
}

function asRange(range?: MetricsRange): Range | null {
  return range?.start && range?.end ? { start: range.start, end: range.end } : null;
}

export async function getClientDiagnostics(db: D1Database, clientId: number, range?: MetricsRange): Promise<ClientDiagnostics> {
  const [totals, quality] = await Promise.all([
    getClientTotals(db, clientId, range),
    computeQuality(db, clientId, range),
  ]);
  // O dashboard continua abrindo em bancos locais criados antes da migração 0011.
  // Nesse caso, metas ficam vazias até a migração ser aplicada; dados legados não quebram.
  let goals: Awaited<ReturnType<typeof listGoals>> = [];
  try {
    goals = await listGoals(db, clientId);
  } catch (error) {
    if (!String(error).includes("no such table: goals")) throw error;
  }
  const period = quality.period ?? { start: range?.start ?? null, end: range?.end ?? null };
  const current = asRange(range) ?? (quality.period ? quality.period : null);
  let previousTotals;
  if (current) previousTotals = (await getClientComparison(db, clientId, current, precedingRange(current))).b.totals;
  const result = evaluateDiagnostics({
    totals,
    previousTotals,
    qualityLevel: quality.level,
    qualityMessage: quality.issues.map((issue) => issue.message).join(" "),
    goals,
    period,
  });
  return { goals, ...result, period };
}
