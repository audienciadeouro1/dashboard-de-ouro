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
      name: "Sushi Teste",
      slug: "sushi-teste",
      dashboardProfile: "pixel_sales",
      metaAdAccountId: "999888777",
    });
    const all = await listClients(env.DB);
    const created = all.find((c) => c.slug === "sushi-teste");
    expect(created).toBeDefined();
    expect(created?.name).toBe("Sushi Teste");
    expect(created?.dashboardProfile).toBe("pixel_sales");
    expect(created?.metaAdAccountId).toBe("999888777");
    expect(created?.lastSyncedAt).toBeNull();
  });

  it("busca por slug e retorna null quando não existe", async () => {
    await createClient(env.DB, {
      name: "Cliente X",
      slug: "cliente-x",
      dashboardProfile: "whatsapp_external",
    });
    const found = await getClientBySlug(env.DB, "cliente-x");
    expect(found?.name).toBe("Cliente X");
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
