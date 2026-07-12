import { createServerFn } from "@tanstack/react-start";
import type { Client, ClientInput } from "./server/clients";
import type { AdRow } from "./csv/types";

// Imports dinâmicos dentro dos handlers: executam apenas no servidor.
// Imports estáticos de código de /server/ são bloqueados no bundle do cliente.
async function serverDeps() {
  const [{ getDb }, clients, insights] = await Promise.all([
    import("./server/db"),
    import("./server/clients"),
    import("./server/insights"),
  ]);
  const db = await getDb();
  return { db, ...clients, ...insights };
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
