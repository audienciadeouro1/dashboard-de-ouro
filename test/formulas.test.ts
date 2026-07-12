import { describe, it, expect } from "vitest";
import {
  safeDiv,
  ctr,
  cpc,
  cpm,
  roas,
  cpa,
  costPerResult,
  costPerConversation,
  costPerThruplay,
  frequency,
  ticketMedio,
} from "../src/lib/metrics/formulas";

describe("fórmulas puras (gabarito = comportamento atual)", () => {
  it("safeDiv divide e devolve 0 com denominador 0 (nunca NaN/Infinity)", () => {
    expect(safeDiv(10, 4)).toBe(2.5);
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(0, 0)).toBe(0);
    expect(Number.isFinite(safeDiv(1, 0))).toBe(true);
  });

  it("ctr = cliques/impressões × 100", () => {
    expect(ctr(50, 1000)).toBe(5);
    expect(ctr(60, 1500)).toBe(4);
    expect(ctr(5, 0)).toBe(0);
  });

  it("cpc = investimento/cliques", () => {
    expect(cpc(150, 60)).toBe(2.5);
    expect(cpc(100, 0)).toBe(0);
  });

  it("cpm = investimento/impressões × 1000", () => {
    expect(cpm(150, 1500)).toBe(100);
    expect(cpm(10, 0)).toBe(0);
  });

  it("roas = faturamento/investimento", () => {
    expect(roas(600, 150)).toBe(4);
    expect(roas(500, 0)).toBe(0);
  });

  it("cpa = investimento/compras", () => {
    expect(cpa(150, 4)).toBe(37.5);
    expect(cpa(150, 0)).toBe(0);
  });

  it("custo por resultado / conversa / thruplay", () => {
    expect(costPerResult(150, 14)).toBeCloseTo(10.714285714285714, 12);
    expect(costPerConversation(150, 10)).toBe(15);
    expect(costPerThruplay(90, 30)).toBe(3);
    expect(costPerResult(150, 0)).toBe(0);
    expect(costPerConversation(150, 0)).toBe(0);
    expect(costPerThruplay(90, 0)).toBe(0);
  });

  it("frequency = impressões/alcance", () => {
    expect(frequency(1500, 1200)).toBe(1.25);
    expect(frequency(1500, 0)).toBe(0);
  });

  it("ticketMedio = faturamento/compras, com fallback quando não há compras", () => {
    expect(ticketMedio(600, 4)).toBe(150);
    expect(ticketMedio(600, 0)).toBe(0);
    expect(ticketMedio(600, 0, 166.7)).toBe(166.7);
  });
});
