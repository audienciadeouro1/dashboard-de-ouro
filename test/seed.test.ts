import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getClientBySlug } from "../src/lib/server/clients";

describe("seed", () => {
  it("Maria Maria e Aki Sushi existem com perfis corretos", async () => {
    const mm = await getClientBySlug(env.DB, "maria-maria");
    const aki = await getClientBySlug(env.DB, "aki-sushi");
    expect(mm?.dashboardProfile).toBe("whatsapp_external");
    expect(aki?.dashboardProfile).toBe("pixel_sales");
    expect(aki?.metaAdAccountId).toBe("1067373311996985");
  });
});
