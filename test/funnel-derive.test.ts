import { describe, it, expect } from "vitest";
import { deriveFunnel, type FunnelStage } from "../src/lib/metrics/funnel";

const stages: FunnelStage[] = [
  { key: "impressions", label: "Impressões", source: "meta", count: 1000 },
  { key: "conversations", label: "Conversas", source: "meta", count: 100 },
  { key: "contatos", label: "Contatos", source: "commercial", count: 80 },
  { key: "vendas", label: "Vendas", source: "commercial", count: 20 },
];

describe("deriveFunnel", () => {
  it("calcula conversão e perda por etapa", () => {
    const r = deriveFunnel(stages, 1000, 5000);
    expect(r.stages[0].conversionFromPrev).toBeNull();
    expect(r.stages[1].conversionFromPrev).toBeCloseTo(0.1);
    expect(r.stages[1].dropFromPrev).toBe(900);
    expect(r.stages[3].conversionFromPrev).toBeCloseTo(0.25);
  });
  it("vendas = última etapa; ROAS/CAC/ticket reais", () => {
    const r = deriveFunnel(stages, 1000, 5000);
    expect(r.sales).toBe(20);
    expect(r.roas).toBeCloseTo(5);
    expect(r.cac).toBeCloseTo(50);
    expect(r.ticket).toBeCloseTo(250);
  });
  it("divisão por zero → 0 e perda nunca negativa", () => {
    const r = deriveFunnel(
      [
        { key: "a", label: "A", source: "meta", count: 0 },
        { key: "b", label: "B", source: "commercial", count: 10 },
      ],
      0,
      0,
    );
    expect(r.roas).toBe(0);
    expect(r.cac).toBe(0);
    expect(r.ticket).toBe(0);
    expect(r.stages[1].conversionFromPrev).toBe(0);
    expect(r.stages[1].dropFromPrev).toBe(0);
  });
});
