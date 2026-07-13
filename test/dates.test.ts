import { describe, it, expect } from "vitest";
import { toISODate, addDaysISO } from "../src/lib/dates";

describe("toISODate", () => {
  it("formata Date como YYYY-MM-DD no fuso local (sem UTC shift)", () => {
    expect(toISODate(new Date(2026, 6, 12))).toBe("2026-07-12");
    expect(toISODate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("addDaysISO", () => {
  it("subtrai dias atravessando o mês", () => {
    expect(addDaysISO("2026-07-01", -1)).toBe("2026-06-30");
  });
  it("soma dias atravessando o ano", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("janela de 30 dias termina no mesmo dia", () => {
    expect(addDaysISO("2026-07-30", -(30 - 1))).toBe("2026-07-01");
  });
});
