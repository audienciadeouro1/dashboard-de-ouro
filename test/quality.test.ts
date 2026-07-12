import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import { computeQuality } from "../src/lib/server/quality";
import type { AdRow } from "../src/lib/csv/types";

const FULL_RAW = {
  "Valor usado (BRL)": "1",
  "Impressões": "1",
  "Cliques no link": "1",
  "Resultados": "1",
  "Valor de conversão da compra": "1",
};

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
    spend: 10,
    impressions: 100,
    reach: 80,
    frequency: 0,
    clicks: 5,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    results: 1,
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
    rawData: FULL_RAW,
    ...overrides,
  };
}

describe("qualidade de dados v1", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `Q${Date.now()}${Math.random()}`,
      slug: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("dados completos e recentes → score 100, nível ok, sem issues", async () => {
    await upsertInsights(
      env.DB,
      clientId,
      [
        makeRow({ date: "2026-07-10" }),
        makeRow({ date: "2026-07-11" }),
        makeRow({ date: "2026-07-12" }),
      ],
      "csv",
    );
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    expect(r.score).toBe(100);
    expect(r.level).toBe("ok");
    expect(r.issues).toHaveLength(0);
    expect(r.period).toEqual({ start: "2026-07-10", end: "2026-07-12" });
  });

  it("buracos no período descontam 3 pontos por dia e explicam quais dias", async () => {
    await upsertInsights(
      env.DB,
      clientId,
      [makeRow({ date: "2026-07-08" }), makeRow({ date: "2026-07-12" })], // faltam 09, 10, 11
      "csv",
    );
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    expect(r.score).toBe(91); // 100 - 3*3
    expect(r.level).toBe("ok");
    const issue = r.issues.find((i) => i.kind === "dias_sem_dados");
    expect(issue).toBeDefined();
    expect(issue!.penalty).toBe(9);
    expect(issue!.message).toContain("2026-07-09");
  });

  it("dados com datas brasileiras no row_json também funcionam (coluna normalizada)", async () => {
    await upsertInsights(
      env.DB,
      clientId,
      [makeRow({ date: "10/07/2026" }), makeRow({ date: "12/07/2026" })], // falta 11/07
      "csv",
    );
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    expect(r.period).toEqual({ start: "2026-07-10", end: "2026-07-12" });
    const issue = r.issues.find((i) => i.kind === "dias_sem_dados");
    expect(issue!.message).toContain("2026-07-11");
  });

  it("dados desatualizados: >7 dias = atenção, >14 dias = problema", async () => {
    await upsertInsights(env.DB, clientId, [makeRow({ date: "2026-07-01" })], "csv");
    const r8 = await computeQuality(env.DB, clientId, { today: "2026-07-09" });
    expect(r8.issues.find((i) => i.kind === "dados_desatualizados")!.penalty).toBe(10);
    const r15 = await computeQuality(env.DB, clientId, { today: "2026-07-16" });
    expect(r15.issues.find((i) => i.kind === "dados_desatualizados")!.penalty).toBe(20);
  });

  it("coluna importante ausente no CSV desconta 5 e cita a métrica", async () => {
    const raw = {
      "Impressões": "1",
      "Cliques no link": "1",
      "Resultados": "1",
      "Valor de conversão da compra": "1",
    }; // sem investimento
    await upsertInsights(env.DB, clientId, [makeRow({ date: "2026-07-12", rawData: raw })], "csv");
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    const issue = r.issues.find((i) => i.kind === "colunas_ausentes");
    expect(issue).toBeDefined();
    expect(issue!.penalty).toBe(5);
    expect(issue!.message).toContain("Investimento");
  });

  it("sem dados no período → score 0, nível problema, mensagem clara", async () => {
    const r = await computeQuality(env.DB, clientId, {
      start: "2030-01-01",
      end: "2030-01-31",
      today: "2026-07-12",
    });
    expect(r.score).toBe(0);
    expect(r.level).toBe("problema");
    expect(r.issues[0].kind).toBe("sem_dados");
    expect(r.issues[0].message).toBe("Sem dados no período selecionado.");
  });
});
