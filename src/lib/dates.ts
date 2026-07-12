/** Formata uma data como YYYY-MM-DD usando os campos locais (America/Sao_Paulo na prática). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normaliza uma data em texto para YYYY-MM-DD (padrão do banco).
 * Aceita DD/MM/YYYY (CSV da Meta em PT-BR) e YYYY-MM-DD; outros formatos voltam como estão.
 */
export function normalizeDateToISO(s: string): string {
  const clean = (s ?? "").trim();
  const br = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return clean;
}
