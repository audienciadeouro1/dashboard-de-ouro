import type { D1Database } from "@cloudflare/workers-types";
import { getWorkerEnv } from "./env";

export async function getDb(): Promise<D1Database> {
  const env = await getWorkerEnv();
  if (!env.DB) throw new Error("Binding DB não encontrado.");
  return env.DB;
}
