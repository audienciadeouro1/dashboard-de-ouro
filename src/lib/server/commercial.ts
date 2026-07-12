import type { D1Database } from "@cloudflare/workers-types";

export interface CommercialPeriodInput {
  startDate: string;
  endDate: string;
  label: string;
  row: Record<string, string>;
}

export interface CommercialPeriodRow {
  id: number;
  clientId: number;
  startDate: string;
  endDate: string;
  label: string;
  row: Record<string, string>;
  source: string;
}

const UPSERT = `
INSERT INTO commercial_periods (client_id, start_date, end_date, label, row_json, source)
VALUES (?, ?, ?, ?, ?, 'csv')
ON CONFLICT (client_id, start_date) DO UPDATE SET
  end_date = excluded.end_date,
  label = excluded.label,
  row_json = excluded.row_json,
  source = excluded.source
`;

export async function upsertCommercialPeriods(
  db: D1Database,
  clientId: number,
  periods: CommercialPeriodInput[],
): Promise<number> {
  if (periods.length === 0) return 0;
  const stmt = db.prepare(UPSERT);
  const BATCH = 100;
  for (let i = 0; i < periods.length; i += BATCH) {
    const chunk = periods.slice(i, i + BATCH);
    await db.batch(
      chunk.map((p) =>
        stmt.bind(clientId, p.startDate, p.endDate, p.label, JSON.stringify(p.row)),
      ),
    );
  }
  return periods.length;
}

export async function getCommercialPeriods(
  db: D1Database,
  clientId: number,
): Promise<CommercialPeriodRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, client_id, start_date, end_date, label, row_json, source
       FROM commercial_periods WHERE client_id = ? ORDER BY start_date ASC`,
    )
    .bind(clientId)
    .all<{
      id: number;
      client_id: number;
      start_date: string;
      end_date: string;
      label: string;
      row_json: string;
      source: string;
    }>();
  return results.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    startDate: r.start_date,
    endDate: r.end_date,
    label: r.label,
    row: JSON.parse(r.row_json) as Record<string, string>,
    source: r.source,
  }));
}
