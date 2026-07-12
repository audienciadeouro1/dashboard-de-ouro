import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { recordImport, listImports } from "../src/lib/server/imports";

describe("histórico de importações", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Date.now()}${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("registra e lista importações do mais recente para o mais antigo", async () => {
    await recordImport(env.DB, clientId, {
      kind: "meta_csv",
      fileName: "julho.csv",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-10",
      rowsSaved: 42,
    });
    await recordImport(env.DB, clientId, {
      kind: "external_weekly",
      fileName: "salao.csv",
      rowsSaved: 4,
    });

    const list = await listImports(env.DB, clientId);
    expect(list).toHaveLength(2);
    expect(list[0].kind).toBe("external_weekly");
    expect(list[1]).toMatchObject({
      kind: "meta_csv",
      fileName: "julho.csv",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-10",
      rowsSaved: 42,
    });
  });

  it("importações são isoladas por cliente", async () => {
    await recordImport(env.DB, clientId, { kind: "meta_csv", rowsSaved: 1 });
    const other = await createClient(env.DB, {
      name: `Outro${Math.random()}`,
      slug: `outro-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "leads",
    });
    expect(await listImports(env.DB, other.id)).toHaveLength(0);
  });
});

describe("schema saneado (migrações 0004–0006)", () => {
  it("tabela leads foi removida (escopo sem CRM)", async () => {
    const row = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'leads'",
    ).first();
    expect(row).toBeNull();
  });

  it("ad_daily_insights tem colunas clicks e reach", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(ad_daily_insights)").all<{
      name: string;
    }>();
    const cols = results.map((r) => r.name);
    expect(cols).toContain("clicks");
    expect(cols).toContain("reach");
  });
});
