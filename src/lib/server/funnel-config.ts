import type { D1Database } from "@cloudflare/workers-types";
import type { FunnelConfig } from "../csv/types";

export async function getFunnelConfig(
  db: D1Database,
  clientId: number,
): Promise<FunnelConfig | null> {
  const row = await db
    .prepare("SELECT config_json FROM funnel_configs WHERE client_id = ?")
    .bind(clientId)
    .first<{ config_json: string }>();
  if (!row) return null;
  return JSON.parse(row.config_json) as FunnelConfig;
}

export async function saveFunnelConfig(
  db: D1Database,
  clientId: number,
  config: FunnelConfig,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO funnel_configs (client_id, config_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT (client_id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at = excluded.updated_at`,
    )
    .bind(clientId, JSON.stringify(config))
    .run();
}
