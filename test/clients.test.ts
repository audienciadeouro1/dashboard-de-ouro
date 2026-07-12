import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  listClients,
  getClientBySlug,
  createClient,
  updateClient,
  touchLastSynced,
} from "../src/lib/server/clients";

describe("clients repo", () => {
  it("cria e lista clientes", async () => {
    await createClient(env.DB, {
      name: "Aki Sushi",
      slug: "aki-sushi",
      dashboardProfile: "pixel_sales",
      metaAdAccountId: "1067373311996985",
    });
    const all = await listClients(env.DB);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Aki Sushi");
    expect(all[0].dashboardProfile).toBe("pixel_sales");
    expect(all[0].metaAdAccountId).toBe("1067373311996985");
    expect(all[0].lastSyncedAt).toBeNull();
  });

  it("busca por slug e retorna null quando não existe", async () => {
    await createClient(env.DB, {
      name: "Maria Maria",
      slug: "maria-maria",
      dashboardProfile: "whatsapp_external",
    });
    const found = await getClientBySlug(env.DB, "maria-maria");
    expect(found?.name).toBe("Maria Maria");
    expect(await getClientBySlug(env.DB, "nao-existe")).toBeNull();
  });

  it("rejeita slug duplicado", async () => {
    await createClient(env.DB, { name: "A", slug: "dup", dashboardProfile: "pixel_sales" });
    await expect(
      createClient(env.DB, { name: "B", slug: "dup", dashboardProfile: "pixel_sales" }),
    ).rejects.toThrow();
  });

  it("atualiza cliente e marca sincronização", async () => {
    const c = await createClient(env.DB, {
      name: "A",
      slug: "a",
      dashboardProfile: "pixel_sales",
    });
    const updated = await updateClient(env.DB, c.id, { name: "A2", color: "#FFD700" });
    expect(updated.name).toBe("A2");
    expect(updated.color).toBe("#FFD700");
    await touchLastSynced(env.DB, c.id);
    const after = await getClientBySlug(env.DB, "a");
    expect(after?.lastSyncedAt).not.toBeNull();
  });
});
