import { describe, it, expect } from "vitest";
import { buildCommercialPeriods } from "../src/lib/csv/commercial";
import type { FunnelConfig } from "../src/lib/csv/types";

const config: FunnelConfig = {
  metaStages: [],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [{ key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" }],
  },
};

describe("buildCommercialPeriods", () => {
  it("monta períodos a partir das linhas e ignora linhas sem período válido", () => {
    const rows = [
      { Semana: "16/04 a 18/04", "Contatos Whatsapp": "28", Total: "284,9", TM: "142,45" },
      { Semana: "Total Geral", "Contatos Whatsapp": "191", Total: "3200", TM: "" },
    ];
    const out = buildCommercialPeriods(rows, config, 2026);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04" });
    expect(out[0].row["Contatos Whatsapp"]).toBe("28");
  });
});
