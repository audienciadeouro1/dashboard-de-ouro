import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights, getInsights, getDataRange, adKeyFor } from "../src/lib/server/insights";
import type { AdRow } from "../src/lib/csv/types";

function makeRow(overrides: Partial<AdRow> = {}): AdRow {
  return {
    campaignName: "Campanha A",
    adSetName: "Conjunto 1",
    adName: "Anúncio X",
    date: "2026-07-01",
    endDate: "2026-07-01",
    objective: "",
    delivery: "",
    budget: 0,
    budgetType: "",
    attribution: "",
    spend: 100,
    impressions: 1000,
    reach: 800,
    frequency: 1.25,
    clicks: 50,
    ctr: 5,
    cpc: 2,
    cpm: 100,
    results: 10,
    resultIndicator: "",
    resultUnit: "",
    costPerResult: 10,
    purchases: 3,
    cpa: 33.3,
    conversionValue: 500,
    averageConversionValue: 166.7,
    roas: 5,
    conversations: 8,
    costPerConversation: 12.5,
    videoPlays: 0,
    thruplays: 0,
    video25: 0,
    video50: 0,
    video75: 0,
    video95: 0,
    engagement: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    ctrTodos: 0,
    rawData: { "Nome da campanha": "Campanha A" },
    ...overrides,
  };
}

describe("insights repo", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Date.now()}${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("grava e reconstrói AdRow completo (roundtrip)", async () => {
    const row = makeRow();
    const n = await upsertInsights(env.DB, clientId, [row], "csv");
    expect(n).toBe(1);
    const rows = await getInsights(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(row);
  });

  it("mesmo CSV duas vezes não duplica", async () => {
    const rows = [makeRow(), makeRow({ adName: "Anúncio Y" })];
    await upsertInsights(env.DB, clientId, rows, "csv");
    await upsertInsights(env.DB, clientId, rows, "csv");
    expect(await getInsights(env.DB, clientId)).toHaveLength(2);
  });

  it("dado novo para o mesmo endereço substitui o antigo (Meta refina retroativamente)", async () => {
    await upsertInsights(env.DB, clientId, [makeRow({ spend: 100 })], "csv");
    await upsertInsights(env.DB, clientId, [makeRow({ spend: 120 })], "meta_api");
    const rows = await getInsights(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0].spend).toBe(120);
  });

  it("filtra por período", async () => {
    await upsertInsights(
      env.DB,
      clientId,
      [
        makeRow({ date: "2026-06-15" }),
        makeRow({ date: "2026-07-01" }),
        makeRow({ date: "2026-07-20" }),
      ],
      "csv",
    );
    const july = await getInsights(env.DB, clientId, { start: "2026-07-01", end: "2026-07-31" });
    expect(july.map((r) => r.date).sort()).toEqual(["2026-07-01", "2026-07-20"]);
  });

  it("retorna intervalo de dados disponível", async () => {
    expect(await getDataRange(env.DB, clientId)).toBeNull();
    await upsertInsights(
      env.DB,
      clientId,
      [makeRow({ date: "2026-06-15" }), makeRow({ date: "2026-07-20" })],
      "csv",
    );
    expect(await getDataRange(env.DB, clientId)).toEqual({
      minDate: "2026-06-15",
      maxDate: "2026-07-20",
    });
  });

  it("adKeyFor compõe campanha|conjunto|anúncio", () => {
    expect(adKeyFor(makeRow())).toBe("Campanha A|Conjunto 1|Anúncio X");
  });

  it("CSV com data brasileira (DD/MM/YYYY) é filtrável por período ISO", async () => {
    // Bug real: CSVs da Meta em PT-BR gravam '05/07/2026'; o filtro SQL compara texto ISO.
    await upsertInsights(
      env.DB,
      clientId,
      [makeRow({ date: "05/07/2026" }), makeRow({ date: "20/06/2026", adName: "Anúncio Y" })],
      "csv",
    );
    const july = await getInsights(env.DB, clientId, { start: "2026-07-01", end: "2026-07-31" });
    expect(july).toHaveLength(1);
    // row_json preserva o formato original do CSV (nada muda na tela)
    expect(july[0].date).toBe("05/07/2026");
    // e o intervalo disponível sai em ISO
    expect(await getDataRange(env.DB, clientId)).toEqual({
      minDate: "2026-06-20",
      maxDate: "2026-07-05",
    });
  });
});
