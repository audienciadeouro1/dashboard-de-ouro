import { createServerFn } from "@tanstack/react-start";
import type { Client, ClientInput } from "./server/clients";
import type { AdRow, FunnelConfig } from "./csv/types";

// Imports dinâmicos dentro dos handlers: executam apenas no servidor.
// Imports estáticos de código de /server/ são bloqueados no bundle do cliente.
async function serverDeps() {
  const [{ getDb }, clients, insights, external, imports, metrics, quality, commercial, funnelConfig] =
    await Promise.all([
      import("./server/db"),
      import("./server/clients"),
      import("./server/insights"),
      import("./server/external"),
      import("./server/imports"),
      import("./server/metrics"),
      import("./server/quality"),
      import("./server/commercial"),
      import("./server/funnel-config"),
    ]);
  const db = await getDb();
  return {
    db,
    ...clients,
    ...insights,
    ...external,
    ...imports,
    ...metrics,
    ...quality,
    ...commercial,
    ...funnelConfig,
  };
}

/** Menor e maior data de um conjunto de linhas (datas em YYYY-MM-DD ordenam como texto). */
function dateRangeOf(dates: string[]): { start: string | null; end: string | null } {
  if (dates.length === 0) return { start: null, end: null };
  let start = dates[0];
  let end = dates[0];
  for (const d of dates) {
    if (d < start) start = d;
    if (d > end) end = d;
  }
  return { start, end };
}

export const fetchClients = createServerFn({ method: "GET" }).handler(
  async (): Promise<Client[]> => {
    const { db, listClients } = await serverDeps();
    return listClients(db);
  },
);

export const fetchClientBySlug = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }): Promise<Client | null> => {
    const { db, getClientBySlug } = await serverDeps();
    return getClientBySlug(db, data);
  });

export const fetchClientData = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; start?: string; end?: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ client: Client; rows: AdRow[]; externalWeekly?: any[] } | null> => {
      const { db, getClientBySlug, getInsights, getExternalWeeklyData } = await serverDeps();
      const client = await getClientBySlug(db, data.slug);
      if (!client) return null;
      const isExternal = client.dashboardProfile === "maria-maria";
      const [rows, externalWeekly] = await Promise.all([
        getInsights(db, client.id, { start: data.start, end: data.end }),
        isExternal ? getExternalWeeklyData(db, client.id) : Promise.resolve(undefined),
      ]);
      return { client, rows, externalWeekly };
    },
  );

export const fetchClientMetrics = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; start?: string; end?: string }) => input)
  .handler(async ({ data }) => {
    const { db, getClientBySlug, getClientTotals, getClientTimeSeries } = await serverDeps();
    const client = await getClientBySlug(db, data.slug);
    if (!client) return null;
    const range = { start: data.start, end: data.end };
    const [totals, series] = await Promise.all([
      getClientTotals(db, client.id, range),
      getClientTimeSeries(db, client.id, range),
    ]);
    return { totals, series };
  });

export const fetchDataQuality = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; start?: string; end?: string }) => input)
  .handler(async ({ data }) => {
    const { db, getClientBySlug, computeQuality } = await serverDeps();
    const client = await getClientBySlug(db, data.slug);
    if (!client) return null;
    return computeQuality(db, client.id, { start: data.start, end: data.end });
  });

export const addClient = createServerFn({ method: "POST" })
  .inputValidator((input: ClientInput) => input)
  .handler(async ({ data }): Promise<Client> => {
    const { db, createClient } = await serverDeps();
    return createClient(db, data);
  });

export const ingestCsvRows = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId: number; rows: AdRow[]; fileName?: string }) => input)
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const { db, upsertInsights, touchLastSynced, recordImport } = await serverDeps();
    const saved = await upsertInsights(db, data.clientId, data.rows, "csv");
    await touchLastSynced(db, data.clientId);
    const range = dateRangeOf(data.rows.map((r) => r.date));
    await recordImport(db, data.clientId, {
      kind: "meta_csv",
      fileName: data.fileName,
      periodStart: range.start,
      periodEnd: range.end,
      rowsSaved: saved,
    });
    return { saved };
  });

export interface ExternalWeeklyInput {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  contatosWhatsapp: number;
  agendamentos: number;
  agendamentosComServico: number;
  faturamento: number;
  ticketMedio: number;
}

export const ingestExternalWeeklyData = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { clientId: number; weeks: ExternalWeeklyInput[]; fileName?: string }) => input,
  )
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const { db, upsertExternalWeeklyData, recordImport } = await serverDeps();
    const saved = await upsertExternalWeeklyData(db, data.clientId, data.weeks);
    const range = dateRangeOf(data.weeks.map((w) => w.startDate));
    await recordImport(db, data.clientId, {
      kind: "external_weekly",
      fileName: data.fileName,
      periodStart: range.start,
      periodEnd: range.end,
      rowsSaved: saved,
    });
    return { saved };
  });

export const fetchImportHistory = createServerFn({ method: "GET" })
  .inputValidator((clientId: number) => clientId)
  .handler(async ({ data }) => {
    const { db, listImports } = await serverDeps();
    return listImports(db, data);
  });

// --- Fase 2A: dados comerciais genéricos + configuração de funil por cliente ---

export const fetchFunnelConfig = createServerFn({ method: "GET" })
  .inputValidator((clientId: number) => clientId)
  .handler(async ({ data: clientId }) => {
    const { db, getFunnelConfig } = await serverDeps();
    return getFunnelConfig(db, clientId);
  });

export const persistFunnelConfig = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId: number; config: FunnelConfig }) => input)
  .handler(async ({ data }) => {
    const { db, saveFunnelConfig } = await serverDeps();
    await saveFunnelConfig(db, data.clientId, data.config);
    return { ok: true };
  });

export const importCommercialCsv = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { clientId: number; rows: Record<string, string>[]; refYear: number; fileName?: string }) =>
      input,
  )
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const { db, getFunnelConfig, upsertCommercialPeriods, recordImport } = await serverDeps();
    const config = await getFunnelConfig(db, data.clientId);
    if (!config) throw new Error("Configure o mapeamento do funil antes de importar.");
    const { buildCommercialPeriods } = await import("./csv/commercial");
    const periods = buildCommercialPeriods(data.rows, config, data.refYear);
    const saved = await upsertCommercialPeriods(db, data.clientId, periods);
    await recordImport(db, data.clientId, {
      kind: "external_weekly",
      fileName: data.fileName,
      periodStart: periods[0]?.startDate ?? null,
      periodEnd: periods[periods.length - 1]?.endDate ?? null,
      rowsSaved: saved,
    });
    return { saved };
  });

export const fetchCommercialData = createServerFn({ method: "GET" })
  .inputValidator((clientId: number) => clientId)
  .handler(async ({ data: clientId }) => {
    const { db, getCommercialPeriods } = await serverDeps();
    return getCommercialPeriods(db, clientId);
  });

export const runCommercialBackfill = createServerFn({ method: "POST" })
  .inputValidator((clientId: number) => clientId)
  .handler(async ({ data: clientId }) => {
    const { db } = await serverDeps();
    const { backfillCommercialFromExternal } = await import("./server/commercial-backfill");
    return backfillCommercialFromExternal(db, clientId);
  });

import { getCookie, setCookie } from "@tanstack/react-start/server";

export const checkSession = createServerFn({ method: "GET" }).handler(async (): Promise<{ authenticated: boolean }> => {
  const session = getCookie("session");
  return { authenticated: session === "authenticated" };
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { getWorkerEnv } = await import("./server/env");
    const env = await getWorkerEnv();
    if (!env.AUTH_EMAIL || !env.AUTH_PASSWORD) {
      return {
        success: false,
        error:
          "Credenciais do servidor não configuradas (AUTH_EMAIL/AUTH_PASSWORD). Configure via wrangler secret ou .dev.vars.",
      };
    }
    if (data.email === env.AUTH_EMAIL && data.password === env.AUTH_PASSWORD) {
      setCookie("session", "authenticated", {
        maxAge: 60 * 60 * 24 * 7, // 7 dias
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });
      return { success: true };
    }
    return { success: false, error: "Credenciais inválidas" };
  });

export const logout = createServerFn({ method: "POST" }).handler(async (): Promise<{ success: boolean }> => {
  setCookie("session", "", {
    maxAge: 0,
    path: "/"
  });
  return { success: true };
});

