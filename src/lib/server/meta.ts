import type { D1Database } from "@cloudflare/workers-types";
import type { Client } from "./clients";
import { touchLastSynced } from "./clients";
import { deleteInsightsInRange, upsertInsights } from "./insights";
import { getWorkerEnv } from "./env";
import { addDaysISO, todayInSaoPaulo } from "../dates";
import { META_INSIGHT_FIELDS, metaInsightToAdRow, type MetaInsightRow } from "../meta/insights-map";

export interface Range {
  start: string;
  end: string;
}
export interface MetaSyncResult {
  days: number;
  ads: number;
  range: Range;
}
export type FetchInsights = (accountId: string, range: Range) => Promise<MetaInsightRow[]>;

const GRAPH = "https://graph.facebook.com";

function normalizeAccountId(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

interface GraphError {
  error?: { message?: string };
}

/** Busca real na Graph API (nível de anúncio, dia a dia), com paginação. */
export const fetchMetaInsights: FetchInsights = async (accountId, range) => {
  const env = await getWorkerEnv();
  const token = env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Token da Meta não configurado. Defina META_ACCESS_TOKEN.");
  const version = env.META_API_VERSION || "v21.0";
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    fields: META_INSIGHT_FIELDS.join(","),
    time_range: JSON.stringify({ since: range.start, until: range.end }),
    limit: "500",
    access_token: token,
  });
  let url = `${GRAPH}/${version}/${normalizeAccountId(accountId)}/insights?${params.toString()}`;
  const out: MetaInsightRow[] = [];
  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as GraphError & {
      data?: MetaInsightRow[];
      paging?: { next?: string };
    };
    if (json.error) throw new Error(`Meta: ${json.error.message ?? "erro desconhecido"}`);
    if (json.data) out.push(...json.data);
    url = json.paging?.next ?? "";
  }
  return out;
};

/** Chamada leve para validar token + acesso à conta antes de sincronizar. */
export async function testMetaConnection(
  client: Client,
): Promise<{ ok: true; accountName: string }> {
  const env = await getWorkerEnv();
  const token = env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Token da Meta não configurado. Defina META_ACCESS_TOKEN.");
  if (!client.metaAdAccountId)
    throw new Error("Configure o ID da conta de anúncios antes de testar.");
  const version = env.META_API_VERSION || "v21.0";
  const acct = normalizeAccountId(client.metaAdAccountId);
  const res = await fetch(
    `${GRAPH}/${version}/${acct}?fields=name&access_token=${encodeURIComponent(token)}`,
  );
  const json = (await res.json()) as GraphError & { name?: string };
  if (json.error) throw new Error(`Meta: ${json.error.message ?? "sem acesso à conta"}`);
  return { ok: true, accountName: json.name ?? acct };
}

/** Sincroniza a janela móvel: busca, apaga o período e regrava (source meta_api). */
export async function syncClientFromMeta(
  db: D1Database,
  client: Client,
  opts?: { days?: number; today?: string; fetchInsights?: FetchInsights },
): Promise<MetaSyncResult> {
  if (!client.metaAdAccountId) {
    throw new Error("Configure o ID da conta de anúncios antes de sincronizar.");
  }
  const days = opts?.days ?? 30;
  const end = opts?.today ?? todayInSaoPaulo();
  const start = addDaysISO(end, -(days - 1));
  const range: Range = { start, end };
  const fetchInsights = opts?.fetchInsights ?? fetchMetaInsights;

  const raw = await fetchInsights(client.metaAdAccountId, range);
  const rows = raw.map((r) => metaInsightToAdRow(r, client.dashboardProfile));

  await deleteInsightsInRange(db, client.id, start, end);
  await upsertInsights(db, client.id, rows, "meta_api");
  await touchLastSynced(db, client.id);

  const distinctDays = new Set(rows.map((r) => r.date)).size;
  return { days: distinctDays, ads: rows.length, range };
}
