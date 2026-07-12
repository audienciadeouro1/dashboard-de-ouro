import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createClient } from "../src/lib/server/clients";
import {
  getExternalWeeklyData,
  upsertExternalWeeklyData,
} from "../src/lib/server/external";

describe("external weekly data repo", () => {
  it("cria, atualiza e lista dados semanais externos", async () => {
    const client = await createClient(env.DB, {
      name: "Cliente Teste Semanal",
      slug: "cliente-teste-semanal",
      dashboardProfile: "maria-maria",
    });

    const weeks = [
      {
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        contatosWhatsapp: 10,
        agendamentos: 5,
        agendamentosComServico: 3,
        faturamento: 1500.0,
        ticketMedio: 500.0,
      },
      {
        startDate: "2026-07-08",
        endDate: "2026-07-14",
        contatosWhatsapp: 20,
        agendamentos: 10,
        agendamentosComServico: 6,
        faturamento: 3000.0,
        ticketMedio: 500.0,
      },
    ];

    // 1. Inserir dados
    const saved = await upsertExternalWeeklyData(env.DB, client.id, weeks);
    expect(saved).toBe(2);

    // 2. Listar dados
    const all = await getExternalWeeklyData(env.DB, client.id);
    expect(all.length).toBe(2);
    expect(all[0].startDate).toBe("2026-07-01");
    expect(all[0].faturamento).toBe(1500.0);
    expect(all[1].startDate).toBe("2026-07-08");
    expect(all[1].faturamento).toBe(3000.0);

    // 3. Upsert (duplicar data de início para testar ON CONFLICT)
    const updateWeeks = [
      {
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        contatosWhatsapp: 12, // Atualizado
        agendamentos: 6,      // Atualizado
        agendamentosComServico: 4, // Atualizado
        faturamento: 2000.0,  // Atualizado
        ticketMedio: 500.0,
      },
    ];

    await upsertExternalWeeklyData(env.DB, client.id, updateWeeks);
    
    // Deve continuar tendo 2 linhas no total, mas a primeira deve estar atualizada
    const afterUpsert = await getExternalWeeklyData(env.DB, client.id);
    expect(afterUpsert.length).toBe(2);
    const firstWeek = afterUpsert.find((w) => w.startDate === "2026-07-01");
    expect(firstWeek?.contatosWhatsapp).toBe(12);
    expect(firstWeek?.faturamento).toBe(2000.0);
  });
});
