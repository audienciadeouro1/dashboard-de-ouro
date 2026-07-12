import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertCommercialPeriods, getCommercialPeriods } from "../src/lib/server/commercial";

describe("commercial_periods", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("insere e relê preservando a linha crua", async () => {
    const n = await upsertCommercialPeriods(env.DB, clientId, [
      { startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04", row: { Total: "284,9", Agendamentos: "2" } },
    ]);
    expect(n).toBe(1);
    const rows = await getCommercialPeriods(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ startDate: "2026-04-16", label: "16/04 a 18/04" });
    expect(rows[0].row.Total).toBe("284,9");
  });

  it("reimportar o mesmo período não duplica (upsert atualiza)", async () => {
    const p = { startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04", row: { Total: "284,9" } };
    await upsertCommercialPeriods(env.DB, clientId, [p]);
    await upsertCommercialPeriods(env.DB, clientId, [{ ...p, row: { Total: "999" } }]);
    const rows = await getCommercialPeriods(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0].row.Total).toBe("999");
  });
});
