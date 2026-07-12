import { describe, expect, it } from "vitest";
import { evaluateDiagnostics } from "../src/lib/metrics/diagnostics";
import type { Totals } from "../src/lib/csv/aggregate";

const totals = (patch: Partial<Totals> = {}): Totals => ({
  spend: 100, impressions: 10000, reach: 5000, clicks: 100, results: 10, purchases: 2,
  conversionValue: 200, conversations: 20, thruplays: 0, videoPlays: 0, video25: 0,
  video50: 0, video75: 0, video95: 0, engagement: 0, viewContent: 0, addToCart: 0,
  initiateCheckout: 0, budget: 0, ctr: 1, cpc: 1, cpm: 10, roas: 2, cpa: 50,
  costPerResult: 10, costPerConversation: 5, costPerThruplay: 0, frequency: 2, ticketMedio: 100,
  ...patch,
});

describe("evaluateDiagnostics", () => {
  it("dispara alerta quando uma métrica viola meta ou limite do cliente", () => {
    const result = evaluateDiagnostics({
      totals: totals({ roas: 1.2, cpa: 80 }),
      goals: [
        { clientId: 1, metric: "roas", target: 2, limitValue: null, active: true },
        { clientId: 1, metric: "cpa", target: null, limitValue: 60, active: true },
      ],
      period: { start: "2026-07-01", end: "2026-07-07" },
    });
    expect(result.alerts.map((a) => a.ruleKey)).toEqual(["roas_below_target", "cpa_above_limit"]);
    expect(result.diagnostics[0]).toMatchObject({ fact: expect.stringContaining("1.20"), evidence: expect.stringContaining("2.00") });
  });

  it("detecta queda de CTR contra a janela anterior", () => {
    const result = evaluateDiagnostics({
      totals: totals({ ctr: 0.7 }), previousTotals: totals({ ctr: 1 }), goals: [],
      period: { start: "2026-07-08", end: "2026-07-14" },
    });
    expect(result.alerts[0]).toMatchObject({ ruleKey: "ctr_decline", metric: "ctr" });
  });

  it("não cria alertas para metas inativas", () => {
    const result = evaluateDiagnostics({ totals: totals({ roas: 0.2 }), goals: [{ clientId: 1, metric: "roas", target: 2, limitValue: null, active: false }], period: { start: null, end: null } });
    expect(result.alerts).toHaveLength(0);
  });
});
