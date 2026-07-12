import type { D1Database } from "@cloudflare/workers-types";

export type ImportKind = "meta_csv" | "external_weekly";

export interface CsvImport {
  id: number;
  clientId: number;
  kind: ImportKind;
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
  rowsSaved: number;
  createdAt: string;
}

export interface CsvImportInput {
  kind: ImportKind;
  fileName?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  rowsSaved: number;
}

interface ImportRow {
  id: number;
  client_id: number;
  kind: ImportKind;
  file_name: string;
  period_start: string | null;
  period_end: string | null;
  rows_saved: number;
  created_at: string;
}

function toImport(r: ImportRow): CsvImport {
  return {
    id: r.id,
    clientId: r.client_id,
    kind: r.kind,
    fileName: r.file_name,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    rowsSaved: r.rows_saved,
    createdAt: r.created_at,
  };
}

export async function recordImport(
  db: D1Database,
  clientId: number,
  input: CsvImportInput,
): Promise<CsvImport> {
  const row = await db
    .prepare(
      `INSERT INTO csv_imports (client_id, kind, file_name, period_start, period_end, rows_saved)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, client_id, kind, file_name, period_start, period_end, rows_saved, created_at`,
    )
    .bind(
      clientId,
      input.kind,
      input.fileName ?? "",
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.rowsSaved,
    )
    .first<ImportRow>();
  if (!row) throw new Error("Falha ao registrar a importação.");
  return toImport(row);
}

export async function listImports(
  db: D1Database,
  clientId: number,
  limit = 50,
): Promise<CsvImport[]> {
  const { results } = await db
    .prepare(
      `SELECT id, client_id, kind, file_name, period_start, period_end, rows_saved, created_at
       FROM csv_imports WHERE client_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .bind(clientId, limit)
    .all<ImportRow>();
  return results.map(toImport);
}
