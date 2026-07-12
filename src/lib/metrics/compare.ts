export type ComparePreset = "7d" | "30d" | "custom";

export interface Range {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/** Converte YYYY-MM-DD → timestamp UTC (meia-noite), sem drift de fuso. */
function toUTC(date: string): number {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  return Date.UTC(y, m - 1, d);
}

const DAY = 24 * 3600 * 1000;

function fromUTC(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Soma (ou subtrai) dias a uma data YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return fromUTC(toUTC(date) + days * DAY);
}

/** Número de dias (inclusivo) de um intervalo. */
export function rangeLengthDays(r: Range): number {
  return Math.round((toUTC(r.end) - toUTC(r.start)) / DAY) + 1;
}

/**
 * Janelas de 7/30 dias terminando em maxDate; `b` é a janela anterior, de mesmo
 * tamanho, terminando no dia anterior ao início de `a`.
 */
export function computeComparePeriods(maxDate: string, preset: "7d" | "30d"): { a: Range; b: Range } {
  const size = preset === "7d" ? 7 : 30;
  const a: Range = { start: addDays(maxDate, -(size - 1)), end: maxDate };
  return { a, b: precedingRange(a) };
}

/** Período de mesmo tamanho imediatamente anterior a `a`. */
export function precedingRange(a: Range): Range {
  const size = rangeLengthDays(a);
  const end = addDays(a.start, -1);
  const start = addDays(end, -(size - 1));
  return { start, end };
}

/** Variação relativa (a-b)/b; 0 quando b <= 0. */
export function pctChange(a: number, b: number): number {
  return b > 0 ? (a - b) / b : 0;
}
