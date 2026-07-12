import type { D1Database } from "@cloudflare/workers-types";

let cached: D1Database | null = null;

/**
 * Em produção (Worker), usa o binding DB via cloudflare:workers.
 * Em dev (vite dev roda SSR em Node), usa getPlatformProxy do wrangler,
 * que aponta para o mesmo estado local de `wrangler d1 ... --local`.
 * O branch de dev é eliminado do bundle de produção (import.meta.env.DEV).
 */
export async function getDb(): Promise<D1Database> {
  if (cached) return cached;
  if (import.meta.env.DEV) {
    const { getPlatformProxy } = await import("wrangler");
    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      configPath: "wrangler.jsonc",
      persist: true,
    });
    cached = proxy.env.DB;
  } else {
    const { env } = await import("cloudflare:workers");
    cached = (env as unknown as { DB: D1Database }).DB;
  }
  if (!cached) throw new Error("Binding DB não encontrado.");
  return cached;
}
