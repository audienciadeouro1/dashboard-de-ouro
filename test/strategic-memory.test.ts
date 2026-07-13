import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import {
  createStrategicDecision,
  createStrategicTask,
  getClientStrategicMemory,
  updateStrategicTaskStatus,
} from "../src/lib/server/strategic-memory";
import type { AdRow } from "../src/lib/csv/types";

function row(date: string, spend: number, conversionValue: number): AdRow {
  return {
    campaignName: "Campanha",
    adSetName: "Conjunto",
    adName: "Anúncio",
    date,
    endDate: date,
    objective: "",
    delivery: "",
    budget: 0,
    budgetType: "",
    attribution: "",
    spend,
    impressions: 1000,
    reach: 500,
    frequency: 2,
    clicks: 100,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    results: 10,
    resultIndicator: "",
    resultUnit: "",
    costPerResult: 0,
    purchases: 5,
    cpa: 0,
    conversionValue,
    averageConversionValue: 0,
    roas: 0,
    conversations: 20,
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
    viewContent: 0,
    addToCart: 0,
    initiateCheckout: 0,
    ctrTodos: 0,
    rawData: {},
  };
}

describe("memória estratégica", () => {
  let clientId: number;

  beforeEach(async () => {
    const client = await createClient(env.DB, {
      name: `Memória ${Math.random()}`,
      slug: `memory-${Date.now()}-${Math.random()}`,
      dashboardProfile: "sales",
    });
    clientId = client.id;
    await upsertInsights(
      env.DB,
      clientId,
      [row("2026-07-01", 100, 300), row("2026-07-10", 80, 320)],
      "csv",
    );
  });

  it("cria tarefa rastreável e permite concluí-la", async () => {
    const task = await createStrategicTask(env.DB, {
      clientId,
      title: "Revisar criativo da campanha",
      priority: "high",
      origin: { type: "diagnostic", key: "ctr_decline", title: "CTR em queda" },
    });
    const completed = await updateStrategicTaskStatus(env.DB, {
      clientId,
      taskId: task.id,
      status: "completed",
    });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
  });

  it("guarda a referência da decisão e compara variação observada", async () => {
    await createStrategicDecision(env.DB, {
      clientId,
      title: "Testar novo criativo",
      rationale: "CTR em queda no período anterior.",
      origin: { type: "diagnostic", key: "ctr_decline", title: "CTR em queda" },
      baselineStart: "2026-07-01",
      baselineEnd: "2026-07-01",
      evaluationStart: "2026-07-10",
      evaluationEnd: "2026-07-10",
    });
    const memory = await getClientStrategicMemory(env.DB, clientId);
    expect(memory.decisions).toHaveLength(1);
    expect(memory.decisions[0].baseline.metrics.spend).toBe(100);
    expect(memory.decisions[0].observedMetrics?.spend).toBe(80);
    expect(memory.decisions[0].comparison.find((item) => item.metric === "spend")?.difference).toBe(
      -20,
    );
  });
});
