import { describe, it, expect } from "vitest";
import { metaInsightToAdRow, sumActions, resultKindForProfile } from "../src/lib/meta/insights-map";
import type { MetaInsightRow } from "../src/lib/meta/insights-map";

const base: MetaInsightRow = {
  date_start: "2026-07-01",
  date_stop: "2026-07-01",
  campaign_name: "C",
  adset_name: "A",
  ad_name: "Ad",
  spend: "100",
  impressions: "1000",
  reach: "800",
  frequency: "1.25",
  clicks: "50",
  ctr: "5",
  cpc: "2",
  cpm: "100",
};

describe("sumActions", () => {
  it("soma só os tipos pedidos e ignora ausentes", () => {
    const actions = [
      { action_type: "purchase", value: "4" },
      { action_type: "link_click", value: "50" },
    ];
    expect(sumActions(actions, ["purchase", "omni_purchase"])).toBe(4);
    expect(sumActions(undefined, ["purchase"])).toBe(0);
  });
});

describe("resultKindForProfile", () => {
  it("vendas => compras; maria-maria/leads => conversas", () => {
    expect(resultKindForProfile("sales")).toBe("purchases");
    expect(resultKindForProfile("maria-maria")).toBe("conversations");
    expect(resultKindForProfile("leads")).toBe("conversations");
  });
});

describe("metaInsightToAdRow", () => {
  it("mapeia compra + valor (perfil vendas) e deriva ROAS/CPA", () => {
    const raw: MetaInsightRow = {
      ...base,
      actions: [{ action_type: "purchase", value: "4" }],
      action_values: [{ action_type: "purchase", value: "600" }],
    };
    const row = metaInsightToAdRow(raw, "sales");
    expect(row.date).toBe("2026-07-01");
    expect(row.campaignName).toBe("C");
    expect(row.spend).toBe(100);
    expect(row.clicks).toBe(50);
    expect(row.purchases).toBe(4);
    expect(row.conversionValue).toBe(600);
    expect(row.results).toBe(4);
    expect(row.roas).toBe(6);
    expect(row.cpa).toBe(25);
    expect(row.averageConversionValue).toBe(150);
  });

  it("mapeia conversa WhatsApp (perfil maria-maria) e custo por conversa", () => {
    const raw: MetaInsightRow = {
      ...base,
      actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "8" }],
    };
    const row = metaInsightToAdRow(raw, "maria-maria");
    expect(row.conversations).toBe(8);
    expect(row.results).toBe(8);
    expect(row.purchases).toBe(0);
    expect(row.costPerConversation).toBe(12.5);
  });

  it("campos ausentes viram 0 e não quebram", () => {
    const row = metaInsightToAdRow({ date_start: "2026-07-02", date_stop: "2026-07-02" }, "sales");
    expect(row.spend).toBe(0);
    expect(row.roas).toBe(0);
    expect(row.campaignName).toBe("");
  });
});
