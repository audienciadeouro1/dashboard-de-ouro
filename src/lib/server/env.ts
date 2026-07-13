import type { D1Database } from "@cloudflare/workers-types";

export interface WorkerEnv {
  DB: D1Database;
  // Credenciais do login do gestor: em produção via `wrangler secret put`,
  // em dev via .dev.vars (gitignorado). Nunca no código.
  AUTH_EMAIL?: string;
  AUTH_PASSWORD?: string;
  // Integração Meta API: token de System User (produção via wrangler secret,
  // dev via .dev.vars). Versão opcional (default v21.0). Nunca no código.
  META_ACCESS_TOKEN?: string;
  META_API_VERSION?: string;
}

let cached: WorkerEnv | null = null;

/**
 * Em produção (Worker), usa os bindings via cloudflare:workers.
 * Em dev (vite dev roda SSR em Node), usa getPlatformProxy do wrangler,
 * que carrega o mesmo estado local (D1 --local, .dev.vars).
 * O branch de dev é eliminado do bundle de produção (import.meta.env.DEV).
 */
export async function getWorkerEnv(): Promise<WorkerEnv> {
  if (cached) return cached;
  if (import.meta.env.DEV) {
    const { getPlatformProxy } = await import("wrangler");
    const proxy = await getPlatformProxy<WorkerEnv>({
      configPath: "wrangler.jsonc",
      persist: true,
    });
    cached = proxy.env;
  } else {
    const { env } = await import("cloudflare:workers");
    cached = env as unknown as WorkerEnv;
  }
  return cached;
}
