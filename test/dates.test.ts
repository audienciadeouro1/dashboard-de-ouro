import { describe, it, expect } from "vitest";
import { toISODate } from "../src/lib/dates";

describe("toISODate", () => {
  it("formata Date como YYYY-MM-DD no fuso local (sem UTC shift)", () => {
    expect(toISODate(new Date(2026, 6, 12))).toBe("2026-07-12");
    expect(toISODate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});
