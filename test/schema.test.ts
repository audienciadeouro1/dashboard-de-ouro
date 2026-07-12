import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema", () => {
  it("cria as tabelas atuais (leads removida na 0004 — escopo sem CRM)", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('clients','ad_daily_insights','external_weekly_data','csv_imports','leads') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "ad_daily_insights",
      "clients",
      "csv_imports",
      "external_weekly_data",
    ]);
  });
});
