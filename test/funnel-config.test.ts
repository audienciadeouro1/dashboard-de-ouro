import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { getFunnelConfig, saveFunnelConfig } from "../src/lib/server/funnel-config";
import type { FunnelConfig } from "../src/lib/csv/types";

const CONFIG: FunnelConfig = {
  metaStages: [{ key: "conversations", label: "Conversas iniciadas" }],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [{ key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" }],
  },
};

describe("funnel_configs", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("retorna null quando não há config", async () => {
    expect(await getFunnelConfig(env.DB, clientId)).toBeNull();
  });

  it("salva e relê a config; segundo save sobrescreve (sem duplicar)", async () => {
    await saveFunnelConfig(env.DB, clientId, CONFIG);
    expect(await getFunnelConfig(env.DB, clientId)).toEqual(CONFIG);

    const updated = { ...CONFIG, commercial: { ...CONFIG.commercial, revenueColumn: "Faturamento" } };
    await saveFunnelConfig(env.DB, clientId, updated);
    expect(await getFunnelConfig(env.DB, clientId)).toEqual(updated);

    const { results } = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM funnel_configs WHERE client_id = ?")
      .bind(clientId)
      .all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });
});
