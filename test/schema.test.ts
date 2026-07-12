import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema", () => {
  it("cria as quatro tabelas", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('clients','ad_daily_insights','external_weekly_data','leads') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "ad_daily_insights",
      "clients",
      "external_weekly_data",
      "leads",
    ]);
  });
});
