import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient, getClientBySlug } from "../src/lib/server/clients";
import { getInsights } from "../src/lib/server/insights";
import { syncClientFromMeta } from "../src/lib/server/meta";
import type { MetaInsightRow } from "../src/lib/meta/insights-map";

const fakeRows: MetaInsightRow[] = [
  {
    date_start: "2026-07-10",
    date_stop: "2026-07-10",
    campaign_name: "C",
    adset_name: "A",
    ad_name: "Ad1",
    spend: "50",
    impressions: "500",
    clicks: "10",
    actions: [{ action_type: "purchase", value: "2" }],
    action_values: [{ action_type: "purchase", value: "300" }],
  },
];

async function makeClient() {
  const c = await createClient(env.DB, {
    name: `C${Date.now()}${Math.random()}`,
    slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    dashboardProfile: "sales",
    metaAdAccountId: "act_123",
  });
  return (await getClientBySlug(env.DB, c.slug))!;
}

describe("syncClientFromMeta", () => {
  let client: Awaited<ReturnType<typeof makeClient>>;
  beforeEach(async () => {
    client = await makeClient();
  });

  it("busca, grava com source meta_api e retorna contagem", async () => {
    const result = await syncClientFromMeta(env.DB, client, {
      today: "2026-07-30",
      fetchInsights: async () => fakeRows,
    });
    expect(result.range).toEqual({ start: "2026-07-01", end: "2026-07-30" });
    expect(result.ads).toBe(1);
    expect(result.days).toBe(1);
    const rows = await getInsights(env.DB, client.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].purchases).toBe(2);
    expect(rows[0].conversionValue).toBe(300);
  });

  it("sincronizar 2× o mesmo período não duplica", async () => {
    const opts = { today: "2026-07-30", fetchInsights: async () => fakeRows };
    await syncClientFromMeta(env.DB, client, opts);
    await syncClientFromMeta(env.DB, client, opts);
    expect(await getInsights(env.DB, client.id)).toHaveLength(1);
  });

  it("apaga dados antigos do período mesmo que a Meta não retorne aquele anúncio", async () => {
    await syncClientFromMeta(env.DB, client, {
      today: "2026-07-30",
      fetchInsights: async () => fakeRows,
    });
    // Meta agora retorna vazio para o mesmo período => período fica limpo
    await syncClientFromMeta(env.DB, client, {
      today: "2026-07-30",
      fetchInsights: async () => [],
    });
    expect(await getInsights(env.DB, client.id)).toHaveLength(0);
  });

  it("sem ID de conta, erro claro", async () => {
    const noAcct = { ...client, metaAdAccountId: null };
    await expect(
      syncClientFromMeta(env.DB, noAcct, { today: "2026-07-30", fetchInsights: async () => [] }),
    ).rejects.toThrow(/conta de anúncios/i);
  });
});
