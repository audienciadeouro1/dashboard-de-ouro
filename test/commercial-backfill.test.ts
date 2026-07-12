import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertExternalWeeklyData } from "../src/lib/server/external";
import { getCommercialPeriods } from "../src/lib/server/commercial";
import { getFunnelConfig } from "../src/lib/server/funnel-config";
import { backfillCommercialFromExternal } from "../src/lib/server/commercial-backfill";

describe("backfill comercial", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "maria-maria",
    });
    clientId = c.id;
  });

  it("migra semanas do external_weekly_data para commercial_periods e cria a config", async () => {
    await upsertExternalWeeklyData(env.DB, clientId, [
      { startDate: "2026-04-16", endDate: "2026-04-18", contatosWhatsapp: 28, agendamentos: 2, agendamentosComServico: 2, faturamento: 284.9, ticketMedio: 142.45 },
    ]);
    const res = await backfillCommercialFromExternal(env.DB, clientId);
    expect(res.periods).toBe(1);

    const periods = await getCommercialPeriods(env.DB, clientId);
    expect(periods).toHaveLength(1);
    expect(periods[0].row["Contatos Whatsapp"]).toBe("28");
    expect(periods[0].row["Total"]).toBe("284.9");

    const config = await getFunnelConfig(env.DB, clientId);
    expect(config?.commercial.periodColumn).toBe("Semana");
    expect(config?.commercial.revenueColumn).toBe("Total");
  });
});
