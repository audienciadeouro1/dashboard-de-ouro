import { describe, it, expect } from "vitest";
import {
  addDays,
  rangeLengthDays,
  computeComparePeriods,
  precedingRange,
  pctChange,
} from "../src/lib/metrics/compare";

describe("compare — aritmética de datas", () => {
  it("addDays soma e subtrai atravessando meses/anos", () => {
    expect(addDays("2026-07-12", -1)).toBe("2026-07-11");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-07-12", 6)).toBe("2026-07-18");
  });

  it("rangeLengthDays conta inclusivo", () => {
    expect(rangeLengthDays({ start: "2026-07-06", end: "2026-07-12" })).toBe(7);
  });
});

describe("computeComparePeriods", () => {
  it("7 dias: janela atual e anterior contíguas", () => {
    const { a, b } = computeComparePeriods("2026-07-12", "7d");
    expect(a).toEqual({ start: "2026-07-06", end: "2026-07-12" });
    expect(b).toEqual({ start: "2026-06-29", end: "2026-07-05" });
  });

  it("30 dias", () => {
    const { a, b } = computeComparePeriods("2026-07-30", "30d");
    expect(a).toEqual({ start: "2026-07-01", end: "2026-07-30" });
    expect(b).toEqual({ start: "2026-06-01", end: "2026-06-30" });
  });
});

describe("precedingRange", () => {
  it("mesmo tamanho, imediatamente antes", () => {
    expect(precedingRange({ start: "2026-07-10", end: "2026-07-12" })).toEqual({
      start: "2026-07-07",
      end: "2026-07-09",
    });
  });
});

describe("pctChange", () => {
  it("calcula variação relativa e trata base zero", () => {
    expect(pctChange(120, 100)).toBeCloseTo(0.2);
    expect(pctChange(80, 100)).toBeCloseTo(-0.2);
    expect(pctChange(50, 0)).toBe(0);
  });
});
