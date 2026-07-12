import { describe, it, expect } from "vitest";
import { aggregate, totals, timeSeries } from "../src/lib/csv/aggregate";
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

const ROWS: AdRow[] = [
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
];

describe("golden-master: totals/aggregate/timeSeries preservam os números atuais", () => {
  it("totals soma e deriva exatamente como hoje", () => {
    const t = totals(ROWS);
    expect(t.spend).toBe(150);
    expect(t.impressions).toBe(1500);
    expect(t.clicks).toBe(60);
    expect(t.reach).toBe(1200);
    expect(t.purchases).toBe(4);
    expect(t.conversionValue).toBe(600);
    expect(t.conversations).toBe(10);
    expect(t.results).toBe(14);
    expect(t.ctr).toBe(4); // 60/1500*100
    expect(t.cpc).toBe(2.5); // 150/60
    expect(t.cpm).toBe(100); // 150/1500*1000
    expect(t.roas).toBe(4); // 600/150
    expect(t.cpa).toBe(37.5); // 150/4
    expect(t.costPerResult).toBeCloseTo(10.714285714285714, 12);
    expect(t.costPerConversation).toBe(15);
    expect(t.frequency).toBe(1.25); // 1500/1200
    expect(t.ticketMedio).toBe(150); // 600/4
  });

  it("totals de lista vazia devolve zeros (sem NaN)", () => {
    const t = totals([]);
    for (const [k, v] of Object.entries(t)) {
      expect(Number.isFinite(v as number), `campo ${k}`).toBe(true);
    }
    expect(t.spend).toBe(0);
    expect(t.ctr).toBe(0);
    expect(t.ticketMedio).toBe(0);
  });

  it("ticketMedio usa fallback averageConversionValue quando não há compras", () => {
    const t = totals([makeRow({ purchases: 0, conversionValue: 0, averageConversionValue: 87.5 })]);
    expect(t.ticketMedio).toBe(87.5);
  });

  it("aggregate por campanha deriva as mesmas métricas", () => {
    const [a] = aggregate(ROWS, "campaignName");
    expect(a.key).toBe("Campanha A");
    expect(a.spend).toBe(150);
    expect(a.ctr).toBe(4);
    expect(a.cpc).toBe(2.5);
    expect(a.cpm).toBe(100);
    expect(a.roas).toBe(4);
    expect(a.cpa).toBe(37.5);
    expect(a.costPerConversation).toBe(15);
    expect(a.frequency).toBe(1.25);
    expect(a.rows).toBe(2);
  });

  it("timeSeries ordena por data e deriva cpa/custo-conversa por dia", () => {
    const s = timeSeries(ROWS);
    expect(s.map((d) => d.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(s[0].cpa).toBe(10); // 100/10 (cpa da série usa results)
    expect(s[1].costPerConversation).toBe(25); // 50/2
  });
});
