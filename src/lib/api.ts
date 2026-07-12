import { createServerFn } from "@tanstack/react-start";
import type { Client, ClientInput } from "./server/clients";
import type { AdRow } from "./csv/types";

// Imports dinâmicos dentro dos handlers: executam apenas no servidor.
// Imports estáticos de código de /server/ são bloqueados no bundle do cliente.
async function serverDeps() {
  const [{ getDb }, clients, insights, external] = await Promise.all([
    import("./server/db"),
    import("./server/clients"),
    import("./server/insights"),
    import("./server/external"),
  ]);
  const db = await getDb();
  return { db, ...clients, ...insights, ...external };
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
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }): Promise<{ client: Client; rows: AdRow[]; externalWeekly?: any[] } | null> => {
    const { db, getClientBySlug, getInsights, getExternalWeeklyData } = await serverDeps();
    const client = await getClientBySlug(db, data);
    if (!client) return null;
    const isExternal = client.dashboardProfile === "maria-maria" || client.dashboardProfile === "whatsapp_external";
    const [rows, externalWeekly] = await Promise.all([
      getInsights(db, client.id),
      isExternal ? getExternalWeeklyData(db, client.id) : Promise.resolve(undefined),
    ]);
    return { client, rows, externalWeekly };
  });

export const addClient = createServerFn({ method: "POST" })
  .inputValidator((input: ClientInput) => input)
  .handler(async ({ data }): Promise<Client> => {
    const { db, createClient } = await serverDeps();
    return createClient(db, data);
  });

export const ingestCsvRows = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId: number; rows: AdRow[] }) => input)
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const { db, upsertInsights, touchLastSynced } = await serverDeps();
    const saved = await upsertInsights(db, data.clientId, data.rows, "csv");
    await touchLastSynced(db, data.clientId);
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
  .inputValidator((input: { clientId: number; weeks: ExternalWeeklyInput[] }) => input)
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const { db, upsertExternalWeeklyData } = await serverDeps();
    const saved = await upsertExternalWeeklyData(db, data.clientId, data.weeks);
    return { saved };
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

