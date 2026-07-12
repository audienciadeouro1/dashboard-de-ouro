import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertCommercialPeriods } from "../src/lib/server/commercial";
import { upsertInsights } from "../src/lib/server/insights";
import { saveFunnelConfig } from "../src/lib/server/funnel-config";
import { getClientFunnel, periodOverlaps } from "../src/lib/server/funnel";
import type { AdRow, FunnelConfig } from "../src/lib/csv/types";

function adRow(partial: Partial<AdRow> & { rawData: Record<string, string> }): AdRow {
  return {
    campaignName: "C",
    adSetName: "A",
    adName: "Ad",
    date: "2026-07-11",
    endDate: "2026-07-11",
    objective: "",
    delivery: "",
    budget: 0,
    budgetType: "",
    attribution: "",
    spend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    results: 0,
    resultIndicator: "",
    resultUnit: "",
    costPerResult: 0,
    purchases: 0,
    cpa: 0,
    conversionValue: 0,
    averageConversionValue: 0,
    roas: 0,
    conversations: 0,
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
    ...partial,
  };
}

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

describe("getClientFunnel — funil 100% pixel (Aki Sushi)", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `Aki${Math.random()}`,
      slug: `aki-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  const PIXEL_CONFIG: FunnelConfig = {
    metaStages: [
      { key: "impressions", label: "Impressões" },
      { key: "viewContent", label: "Visualizações de conteúdo", column: "Visualizações do conteúdo no site" },
      { key: "addToCart", label: "Adições ao carrinho", column: "Adições ao carrinho" },
      { key: "initiateCheckout", label: "Finalizações iniciadas", column: "Finalizações da compra iniciadas no site" },
      { key: "purchases", label: "Compras" },
    ],
    metaRevenueKey: "conversionValue",
  };

  it("soma eventos de pixel do rawData, vendas = Compras e faturamento do Meta", async () => {
    await saveFunnelConfig(env.DB, clientId, PIXEL_CONFIG);
    await upsertInsights(
      env.DB,
      clientId,
      [
        adRow({
          date: "2026-07-11",
          impressions: 8338,
          purchases: 8,
          conversionValue: 656.45,
          rawData: {
            "Visualizações do conteúdo no site": "44",
            "Adições ao carrinho": "23",
            "Finalizações da compra iniciadas no site": "14",
          },
        }),
        adRow({
          date: "2026-07-12",
          impressions: 105,
          purchases: 0,
          conversionValue: 0,
          rawData: {
            "Visualizações do conteúdo no site": "6",
            "Adições ao carrinho": "0",
            "Finalizações da compra iniciadas no site": "0",
          },
        }),
      ],
      "csv",
    );

    const f = await getClientFunnel(env.DB, clientId);
    expect(f).not.toBeNull();
    expect(f!.stages.map((s) => s.key)).toEqual([
      "impressions",
      "viewContent",
      "addToCart",
      "initiateCheckout",
      "purchases",
    ]);
    expect(f!.stages.find((s) => s.key === "impressions")!.count).toBe(8443);
    expect(f!.stages.find((s) => s.key === "viewContent")!.count).toBe(50);
    expect(f!.stages.find((s) => s.key === "addToCart")!.count).toBe(23);
    expect(f!.stages.find((s) => s.key === "purchases")!.count).toBe(8);
    expect(f!.sales).toBe(8);
    expect(f!.revenue).toBeCloseTo(656.45);
  });
});
