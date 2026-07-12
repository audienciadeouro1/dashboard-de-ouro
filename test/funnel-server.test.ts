import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertCommercialPeriods } from "../src/lib/server/commercial";
import { saveFunnelConfig } from "../src/lib/server/funnel-config";
import { getClientFunnel, periodOverlaps } from "../src/lib/server/funnel";
import type { FunnelConfig } from "../src/lib/csv/types";

const CONFIG: FunnelConfig = {
  metaStages: [{ key: "conversations", label: "Conversas iniciadas" }],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [
      { key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" },
      { key: "vendas", label: "Vendas", column: "Agendamentos com serviço" },
    ],
  },
};

describe("periodOverlaps", () => {
  it("detecta sobreposição com o range", () => {
    expect(periodOverlaps("2026-04-16", "2026-04-18", { start: "2026-04-17", end: "2026-04-30" })).toBe(true);
    expect(periodOverlaps("2026-04-16", "2026-04-18", { start: "2026-05-01", end: "2026-05-30" })).toBe(false);
    expect(periodOverlaps("2026-04-16", "2026-04-18", undefined)).toBe(true);
  });
});

describe("getClientFunnel", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "maria-maria",
    });
    clientId = c.id;
  });

  it("retorna null sem config", async () => {
    expect(await getClientFunnel(env.DB, clientId)).toBeNull();
  });

  it("soma etapas comerciais (números BR) e usa a última como vendas", async () => {
    await saveFunnelConfig(env.DB, clientId, CONFIG);
    await upsertCommercialPeriods(env.DB, clientId, [
      { startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04", row: { "Contatos Whatsapp": "28", "Agendamentos com serviço": "2", Total: "284,9" } },
      { startDate: "2026-04-19", endDate: "2026-04-25", label: "19/04 a 25/04", row: { "Contatos Whatsapp": "138", "Agendamentos com serviço": "5", Total: "1300" } },
    ]);
    const f = await getClientFunnel(env.DB, clientId);
    expect(f).not.toBeNull();
    const contatos = f!.stages.find((s) => s.key === "contatos")!;
    expect(contatos.count).toBe(166);
    expect(f!.sales).toBe(7);
    expect(f!.revenue).toBeCloseTo(1584.9);
  });
});
