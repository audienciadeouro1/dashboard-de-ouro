import type { FunnelConfig } from "./types";
import type { CommercialPeriodInput } from "../server/commercial";

export function parseBRNumber(v: string | number | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const cleaned = v.trim();
  if (cleaned === "" || cleaned === "–" || cleaned === "-") return 0;
  // remove % e espaços; remove separador de milhar "."; troca vírgula decimal por ponto
  const n = parseFloat(cleaned.replace(/%/g, "").replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parsePeriodRange(
  text: string,
  refYear: number,
): { startDate: string; endDate: string } | null {
  if (!text) return null;
  const parts = text.split(/ a | /i).filter((p) => p.includes("/"));
  if (parts.length < 2) return null;
  const [d1, m1] = parts[0].split("/").map((n) => parseInt(n, 10));
  const [d2, m2] = parts[1].split("/").map((n) => parseInt(n, 10));
  if ([d1, m1, d2, m2].some((n) => Number.isNaN(n))) return null;
  const yearEnd = m2 < m1 ? refYear + 1 : refYear;
  return {
    startDate: `${refYear}-${pad2(m1)}-${pad2(d1)}`,
    endDate: `${yearEnd}-${pad2(m2)}-${pad2(d2)}`,
  };
}

export function buildCommercialPeriods(
  rows: Record<string, string>[],
  config: FunnelConfig,
  refYear: number,
): CommercialPeriodInput[] {
  const col = config.commercial?.periodColumn;
  const out: CommercialPeriodInput[] = [];
  if (!col) return out;
  for (const row of rows) {
    const text = row[col];
    const range = parsePeriodRange(text, refYear);
    if (!range) continue;
    out.push({ startDate: range.startDate, endDate: range.endDate, label: text, row });
  }
  return out;
}
