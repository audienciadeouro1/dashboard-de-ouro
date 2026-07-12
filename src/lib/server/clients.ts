import type { D1Database } from "@cloudflare/workers-types";
import type { AnalysisMode } from "../csv/types";

// O perfil do cliente É o modo de análise do dashboard (fonte única: ANALYSIS_MODES).
export type DashboardProfile = AnalysisMode;

export interface Client {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  color: string | null;
  metaAdAccountId: string | null;
  dashboardProfile: DashboardProfile;
  contractStart: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface ClientInput {
  name: string;
  slug: string;
  dashboardProfile: DashboardProfile;
  logoUrl?: string | null;
  color?: string | null;
  metaAdAccountId?: string | null;
  contractStart?: string | null;
}

interface ClientRow {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  color: string | null;
  meta_ad_account_id: string | null;
  dashboard_profile: DashboardProfile;
  contract_start: string | null;
  last_synced_at: string | null;
  created_at: string;
}

function toClient(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url,
    color: r.color,
    metaAdAccountId: r.meta_ad_account_id,
    dashboardProfile: r.dashboard_profile,
    contractStart: r.contract_start,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
  };
}

const COLS =
  "id, name, slug, logo_url, color, meta_ad_account_id, dashboard_profile, contract_start, last_synced_at, created_at";

export async function listClients(db: D1Database): Promise<Client[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM clients ORDER BY name`)
    .all<ClientRow>();
  return results.map(toClient);
}

export async function getClientBySlug(db: D1Database, slug: string): Promise<Client | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM clients WHERE slug = ?`)
    .bind(slug)
    .first<ClientRow>();
  return row ? toClient(row) : null;
}

export async function createClient(db: D1Database, input: ClientInput): Promise<Client> {
  const row = await db
    .prepare(
      `INSERT INTO clients (name, slug, logo_url, color, meta_ad_account_id, dashboard_profile, contract_start)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${COLS}`,
    )
    .bind(
      input.name,
      input.slug,
      input.logoUrl ?? null,
      input.color ?? null,
      input.metaAdAccountId ?? null,
      input.dashboardProfile,
      input.contractStart ?? null,
    )
    .first<ClientRow>();
  if (!row) throw new Error("Falha ao criar cliente.");
  return toClient(row);
}

export async function updateClient(
  db: D1Database,
  id: number,
  input: Partial<ClientInput>,
): Promise<Client> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  const map: Record<string, string> = {
    name: "name",
    slug: "slug",
    logoUrl: "logo_url",
    color: "color",
    metaAdAccountId: "meta_ad_account_id",
    dashboardProfile: "dashboard_profile",
    contractStart: "contract_start",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) {
      sets.push(`${col} = ?`);
      binds.push((input as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) throw new Error("Nada para atualizar.");
  const row = await db
    .prepare(`UPDATE clients SET ${sets.join(", ")} WHERE id = ? RETURNING ${COLS}`)
    .bind(...binds, id)
    .first<ClientRow>();
  if (!row) throw new Error("Cliente não encontrado.");
  return toClient(row);
}

export async function touchLastSynced(db: D1Database, id: number): Promise<void> {
  await db
    .prepare("UPDATE clients SET last_synced_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}
