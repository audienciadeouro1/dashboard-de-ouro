import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import { getClientComparison } from "../src/lib/server/compare";
import type { AdRow } from "../src/lib/csv/types";

function adRow(date: string, spend: number, impressions: number): AdRow {
  return {
    campaignName: "C", adSetName: "A", adName: "Ad", date, endDate: date,
    objective: "", delivery: "", budget: 0, budgetType: "", attribution: "",
    spend, impressions, reach: 0, frequency: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0,
    results: 0, resultIndicator: "", resultUnit: "", costPerResult: 0, purchases: 0,
    cpa: 0, conversionValue: 0, averageConversionValue: 0, roas: 0, conversations: 0,
    costPerConversation: 0, videoPlays: 0, thruplays: 0, video25: 0, video50: 0,
    video75: 0, video95: 0, engagement: 0, reactions: 0, comments: 0, shares: 0,
    viewContent: 0, addToCart: 0, initiateCheckout: 0, ctrTodos: 0, rawData: {},
  };
}

describe("getClientComparison", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("separa os totais por janela de período", async () => {
    await upsertInsights(
      env.DB,
      clientId,
      [
        adRow("2026-07-10", 100, 1000), // período A
        adRow("2026-07-11", 50, 500), // período A
        adRow("2026-07-05", 30, 300), // período B
      ],
      "csv",
    );
    const cmp = await getClientComparison(
      env.DB,
      clientId,
      { start: "2026-07-08", end: "2026-07-14" },
      { start: "2026-07-01", end: "2026-07-07" },
    );
    expect(cmp.a.totals.spend).toBe(150);
    expect(cmp.a.totals.impressions).toBe(1500);
    expect(cmp.b.totals.spend).toBe(30);
    expect(cmp.b.totals.impressions).toBe(300);
    expect(cmp.a.funnel).toBeNull(); // sem funnel_config
  });
});
