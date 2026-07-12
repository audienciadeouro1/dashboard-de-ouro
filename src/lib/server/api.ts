import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import {
  listClients,
  getClientBySlug,
  createClient,
  touchLastSynced,
  type Client,
  type ClientInput,
} from "./clients";
import { upsertInsights } from "./insights";
import type { AdRow } from "../csv/types";

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

export const fetchClients = createServerFn({ method: "GET" }).handler(
  async (): Promise<Client[]> => listClients(db()),
);

export const fetchClientBySlug = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data }): Promise<Client | null> => getClientBySlug(db(), data));

export const addClient = createServerFn({ method: "POST" })
  .inputValidator((input: ClientInput) => input)
  .handler(async ({ data }): Promise<Client> => createClient(db(), data));

export const ingestCsvRows = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId: number; rows: AdRow[] }) => input)
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const saved = await upsertInsights(db(), data.clientId, data.rows, "csv");
    await touchLastSynced(db(), data.clientId);
    return { saved };
  });
