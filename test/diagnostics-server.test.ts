import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import { saveGoal } from "../src/lib/server/goals";
import { getClientDiagnostics } from "../src/lib/server/diagnostics";
import type { AdRow } from "../src/lib/csv/types";

function row(date: string, spend: number, clicks: number): AdRow {
  return {
    campaignName: "Campanha", adSetName: "Conjunto", adName: "Anúncio", date, endDate: date,
    objective: "", delivery: "", budget: 0, budgetType: "", attribution: "", spend, impressions: 1000,
    reach: 500, frequency: 2, clicks, ctr: 0, cpc: 0, cpm: 0, results: 0, resultIndicator: "", resultUnit: "",
    costPerResult: 0, purchases: 0, cpa: 0, conversionValue: 0, averageConversionValue: 0, roas: 0,
    conversations: 0, costPerConversation: 0, videoPlays: 0, thruplays: 0, video25: 0, video50: 0,
    video75: 0, video95: 0, engagement: 0, reactions: 0, comments: 0, shares: 0, viewContent: 0,
    addToCart: 0, initiateCheckout: 0, ctrTodos: 0, rawData: {},
  };
}

describe("getClientDiagnostics", () => {
  let clientId: number;
  beforeEach(async () => {
    const client = await createClient(env.DB, { name: `Diagnóstico ${Math.random()}`, slug: `dx-${Date.now()}-${Math.random()}`, dashboardProfile: "sales" });
    clientId = client.id;
  });

  it("calcula diagnóstico a partir dos dados do D1 e da meta salva", async () => {
    await upsertInsights(env.DB, clientId, [row("2026-07-07", 100, 100), row("2026-07-08", 100, 50)], "csv");
    await saveGoal(env.DB, { clientId, metric: "ctr", target: 10, limitValue: null, active: true });
    const result = await getClientDiagnostics(env.DB, clientId, { start: "2026-07-07", end: "2026-07-08" });
    expect(result.goals).toHaveLength(1);
    expect(result.diagnostics.some((d) => d.ruleKey === "ctr_below_target")).toBe(true);
    expect(result.period).toEqual({ start: "2026-07-07", end: "2026-07-08" });
  });
});
