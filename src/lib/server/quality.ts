import type { D1Database } from "@cloudflare/workers-types";
import { getInsights } from "./insights";
import { datasetFromRows } from "../csv/parser";
import type { CanonicalKey } from "../csv/normalize";

export type QualityLevel = "ok" | "atencao" | "problema";

export interface QualityIssue {
  kind: "dias_sem_dados" | "dados_desatualizados" | "colunas_ausentes" | "sem_dados";
  severity: "atencao" | "problema";
  message: string;
  penalty: number;
}

export interface QualityReport {
  score: number;
  level: QualityLevel;
  issues: QualityIssue[];
  period: { start: string; end: string } | null;
}

/** Métricas cuja ausência no CSV compromete a análise. */
const IMPORTANT_METRICS: { key: CanonicalKey; label: string }[] = [
  { key: "spend", label: "Investimento" },
  { key: "impressions", label: "Impressões" },
  { key: "clicks", label: "Cliques no link" },
  { key: "results", label: "Resultados" },
  { key: "conversionValue", label: "Faturamento" },
];

/** Hoje em America/Sao_Paulo como YYYY-MM-DD ("en-CA" formata nesse padrão). */
function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Lista todos os dias YYYY-MM-DD entre start e end (inclusivos). */
function calendarDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Dias entre duas datas YYYY-MM-DD (b - a). */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000,
  );
}

function levelFor(score: number): QualityLevel {
  if (score >= 90) return "ok";
  if (score >= 70) return "atencao";
  return "problema";
}

/**
 * Qualidade de dados v1 — pontuação explicável, calculada na hora (sem tabela nova).
 * Regras determinísticas:
 *  - dia sem dados no período: −3 cada (teto −30); vira "problema" se faltar mais da metade
 *  - última data com dados há >7 dias: −10 (atenção); >14 dias: −20 (problema)
 *  - coluna importante ausente no CSV: −5 cada (teto −25)
 *  - nenhum dado no período: score 0
 * As datas vêm da COLUNA date (sempre YYYY-MM-DD, migração 0007), não do row_json.
 */
export async function computeQuality(
  db: D1Database,
  clientId: number,
  opts?: { start?: string; end?: string; today?: string },
): Promise<QualityReport> {
  const today = opts?.today ?? todaySaoPaulo();

  // Dias distintos com dados, direto da coluna normalizada.
  let sql = "SELECT DISTINCT date FROM ad_daily_insights WHERE client_id = ?";
  const binds: unknown[] = [clientId];
  if (opts?.start) {
    sql += " AND date >= ?";
    binds.push(opts.start);
  }
  if (opts?.end) {
    sql += " AND date <= ?";
    binds.push(opts.end);
  }
  sql += " ORDER BY date";
  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ date: string }>();
  const dates = results.map((r) => r.date);

  if (dates.length === 0) {
    return {
      score: 0,
      level: "problema",
      issues: [
        {
          kind: "sem_dados",
          severity: "problema",
          message: "Sem dados no período selecionado.",
          penalty: 100,
        },
      ],
      period: opts?.start && opts?.end ? { start: opts.start, end: opts.end } : null,
    };
  }

  const start = opts?.start ?? dates[0];
  const end = opts?.end ?? dates[dates.length - 1];
  const issues: QualityIssue[] = [];

  // 1) Dias sem dados dentro do período avaliado
  const have = new Set(dates);
  const allDays = calendarDays(start, end);
  const missing = allDays.filter((d) => !have.has(d));
  if (missing.length > 0) {
    const penalty = Math.min(30, missing.length * 3);
    const shown = missing.slice(0, 5).join(", ");
    const rest = missing.length > 5 ? ` e mais ${missing.length - 5}` : "";
    issues.push({
      kind: "dias_sem_dados",
      severity: missing.length > allDays.length / 2 ? "problema" : "atencao",
      message: `${missing.length} dia(s) sem dados no período: ${shown}${rest}.`,
      penalty,
    });
  }

  // 2) Dados desatualizados (última data com dados vs hoje)
  const lastDate = dates[dates.length - 1];
  const age = daysBetween(lastDate, today);
  if (age > 14) {
    issues.push({
      kind: "dados_desatualizados",
      severity: "problema",
      message: `Última data com dados é ${lastDate} (há ${age} dias). Importe um CSV mais recente.`,
      penalty: 20,
    });
  } else if (age > 7) {
    issues.push({
      kind: "dados_desatualizados",
      severity: "atencao",
      message: `Última data com dados é ${lastDate} (há ${age} dias).`,
      penalty: 10,
    });
  }

  // 3) Colunas importantes ausentes no CSV importado (via rawData preservado no row_json)
  const rows = await getInsights(db, clientId, { start: opts?.start, end: opts?.end });
  const ds = datasetFromRows(rows, "banco");
  const absent = IMPORTANT_METRICS.filter((m) => ds.missingMetrics.includes(m.key));
  if (absent.length > 0) {
    issues.push({
      kind: "colunas_ausentes",
      severity: "atencao",
      message: `Coluna(s) ausente(s) no CSV importado: ${absent.map((m) => m.label).join(", ")}.`,
      penalty: Math.min(25, absent.length * 5),
    });
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.penalty, 0));
  return { score, level: levelFor(score), issues, period: { start, end } };
}
