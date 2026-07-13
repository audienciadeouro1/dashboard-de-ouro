import type { D1Database } from "@cloudflare/workers-types";
import type { AdRow } from "../csv/types";
import { normalizeDateToISO } from "../dates";

export type InsightSource = "csv" | "meta_api";

export function adKeyFor(row: AdRow): string {
  return `${row.campaignName}|${row.adSetName}|${row.adName}`;
}

const UPSERT = `
INSERT INTO ad_daily_insights (
  client_id, date, ad_key, campaign_name, ad_set_name, ad_name,
  spend, impressions, clicks, reach, conversations, purchases, conversion_value,
  source, row_json, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT (client_id, date, ad_key) DO UPDATE SET
  campaign_name = excluded.campaign_name,
  ad_set_name = excluded.ad_set_name,
  ad_name = excluded.ad_name,
  spend = excluded.spend,
  impressions = excluded.impressions,
  clicks = excluded.clicks,
  reach = excluded.reach,
  conversations = excluded.conversations,
  purchases = excluded.purchases,
  conversion_value = excluded.conversion_value,
  source = excluded.source,
  row_json = excluded.row_json,
  updated_at = excluded.updated_at
`;

export async function upsertInsights(
  db: D1Database,
  clientId: number,
  rows: AdRow[],
  source: InsightSource,
): Promise<number> {
  if (rows.length === 0) return 0;
  const stmt = db.prepare(UPSERT);
  // D1 batch é atômico: ou grava tudo, ou nada (erro no meio não corrompe)
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await db.batch(
      chunk.map((r) =>
        stmt.bind(
          clientId,
          // Coluna date sempre em YYYY-MM-DD (filtros/MIN/MAX comparam texto);
          // o row_json preserva o formato original do CSV para a tela.
          normalizeDateToISO(r.date),
          adKeyFor(r),
          r.campaignName,
          r.adSetName,
          r.adName,
          r.spend,
          r.impressions,
          r.clicks,
          r.reach,
          r.conversations,
          r.purchases,
          r.conversionValue,
          source,
          JSON.stringify(r),
        ),
      ),
    );
  }
  return rows.length;
}

export async function getInsights(
  db: D1Database,
  clientId: number,
  range?: { start?: string; end?: string },
): Promise<AdRow[]> {
  let sql = "SELECT row_json FROM ad_daily_insights WHERE client_id = ?";
  const binds: unknown[] = [clientId];
  if (range?.start) {
    sql += " AND date >= ?";
    binds.push(range.start);
  }
  if (range?.end) {
    sql += " AND date <= ?";
    binds.push(range.end);
  }
  sql += " ORDER BY date, ad_key";
  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ row_json: string }>();
  return results.map((r) => JSON.parse(r.row_json) as AdRow);
}

/** Remove as linhas de um cliente dentro de [start, end] (YYYY-MM-DD). Usado antes
 * de regravar um período com dados frescos da Meta, evitando dupla contagem. */
export async function deleteInsightsInRange(
  db: D1Database,
  clientId: number,
  start: string,
  end: string,
): Promise<number> {
  const res = await db
    .prepare("DELETE FROM ad_daily_insights WHERE client_id = ? AND date >= ? AND date <= ?")
    .bind(clientId, start, end)
    .run();
  return res.meta.changes ?? 0;
}

export async function getDataRange(
  db: D1Database,
  clientId: number,
): Promise<{ minDate: string; maxDate: string } | null> {
  const row = await db
    .prepare(
      "SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM ad_daily_insights WHERE client_id = ?",
    )
    .bind(clientId)
    .first<{ minDate: string | null; maxDate: string | null }>();
  if (!row || row.minDate === null || row.maxDate === null) return null;
  return { minDate: row.minDate, maxDate: row.maxDate };
}
