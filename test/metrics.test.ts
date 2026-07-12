import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import { getClientTotals, getClientTimeSeries } from "../src/lib/server/metrics";
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
    frequency: 0,
    clicks: 50,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    results: 10,
    resultIndicator: "",
    resultUnit: "",
    costPerResult: 0,
    purchases: 3,
    cpa: 0,
    conversionValue: 500,
    averageConversionValue: 0,
    roas: 0,
    conversations: 8,
    costPerConversation: 0,
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
    rawData: {},
    ...overrides,
  };
}

describe("metrics no servidor", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `M${Date.now()}${Math.random()}`,
      slug: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
    await upsertInsights(
      env.DB,
      clientId,
      [
        makeRow(),
        makeRow({
          adName: "Anúncio Y",
          date: "2026-07-02",
          spend: 50,
          impressions: 500,
          reach: 400,
          clicks: 10,
          results: 4,
          purchases: 1,
          conversionValue: 100,
          conversations: 2,
        }),
      ],
      "csv",
    );
  });

  it("calcula totais do banco iguais ao golden-master", async () => {
    const t = await getClientTotals(env.DB, clientId);
    expect(t.spend).toBe(150);
    expect(t.ctr).toBe(4);
    expect(t.cpc).toBe(2.5);
    expect(t.roas).toBe(4);
    expect(t.ticketMedio).toBe(150);
  });

  it("respeita o filtro de período", async () => {
    const t = await getClientTotals(env.DB, clientId, { start: "2026-07-02", end: "2026-07-02" });
    expect(t.spend).toBe(50);
    expect(t.cpc).toBe(5); // 50/10
  });

  it("período sem dados devolve zeros, nunca NaN", async () => {
    const t = await getClientTotals(env.DB, clientId, { start: "2030-01-01", end: "2030-01-31" });
    expect(t.spend).toBe(0);
    expect(Number.isFinite(t.ctr)).toBe(true);
  });

  it("série temporal do banco vem ordenada por dia", async () => {
    const s = await getClientTimeSeries(env.DB, clientId);
    expect(s.map((d) => d.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(s[0].spend).toBe(100);
  });
});
