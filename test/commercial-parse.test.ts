import { describe, it, expect } from "vitest";
import { parseBRNumber, parsePeriodRange } from "../src/lib/csv/commercial";

describe("parseBRNumber", () => {
  it("converte número BR com vírgula decimal e milhar", () => {
    expect(parseBRNumber("1.359,90")).toBeCloseTo(1359.9);
    expect(parseBRNumber("284,9")).toBeCloseTo(284.9);
    expect(parseBRNumber(260)).toBe(260);
    expect(parseBRNumber("260")).toBe(260);
  });
  it("trata vazio, traço e ausente como 0", () => {
    expect(parseBRNumber("")).toBe(0);
    expect(parseBRNumber("–")).toBe(0);
    expect(parseBRNumber(undefined)).toBe(0);
  });
});

describe("parsePeriodRange", () => {
  it("converte intervalo DD/MM a DD/MM usando o ano de referência", () => {
    expect(parsePeriodRange("16/04 a 18/04", 2026)).toEqual({
      startDate: "2026-04-16",
      endDate: "2026-04-18",
    });
  });
  it("vira o ano quando o mês final é menor que o inicial", () => {
    expect(parsePeriodRange("28/12 a 03/01", 2025)).toEqual({
      startDate: "2025-12-28",
      endDate: "2026-01-03",
    });
  });
  it("retorna null para texto sem datas", () => {
    expect(parsePeriodRange("Total Geral", 2026)).toBeNull();
  });
});
