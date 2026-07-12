import type { D1Database } from "@cloudflare/workers-types";

export interface ExternalWeeklyRow {
  id: number;
  clientId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  contatosWhatsapp: number;
  agendamentos: number;
  agendamentosComServico: number;
  faturamento: number;
  ticketMedio: number;
}

export interface ExternalWeeklyInput {
  startDate: string;
  endDate: string;
  contatosWhatsapp: number;
  agendamentos: number;
  agendamentosComServico: number;
  faturamento: number;
  ticketMedio: number;
}

const UPSERT = `
INSERT INTO external_weekly_data (
  client_id, start_date, end_date, contatos_whatsapp,
  agendamentos, agendamentos_com_servico, faturamento, ticket_medio
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (client_id, start_date) DO UPDATE SET
  end_date = excluded.end_date,
  contatos_whatsapp = excluded.contatos_whatsapp,
  agendamentos = excluded.agendamentos,
  agendamentos_com_servico = excluded.agendamentos_com_servico,
  faturamento = excluded.faturamento,
  ticket_medio = excluded.ticket_medio
`;

export async function upsertExternalWeeklyData(
  db: D1Database,
  clientId: number,
  weeks: ExternalWeeklyInput[],
): Promise<number> {
  if (weeks.length === 0) return 0;
  const stmt = db.prepare(UPSERT);
  
  const BATCH_SIZE = 100;
  for (let i = 0; i < weeks.length; i += BATCH_SIZE) {
    const chunk = weeks.slice(i, i + BATCH_SIZE);
    await db.batch(
      chunk.map((w) =>
        stmt.bind(
          clientId,
          w.startDate,
          w.endDate,
          w.contatosWhatsapp,
          w.agendamentos,
          w.agendamentosComServico,
          w.faturamento,
          w.ticketMedio,
        ),
      ),
    );
  }
  return weeks.length;
}

export async function getExternalWeeklyData(
  db: D1Database,
  clientId: number,
): Promise<ExternalWeeklyRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, client_id, start_date, end_date, contatos_whatsapp, agendamentos, agendamentos_com_servico, faturamento, ticket_medio 
       FROM external_weekly_data 
       WHERE client_id = ? 
       ORDER BY start_date ASC`
    )
    .bind(clientId)
    .all<{
      id: number;
      client_id: number;
      start_date: string;
      end_date: string;
      contatos_whatsapp: number;
      agendamentos: number;
      agendamentos_com_servico: number;
      faturamento: number;
      ticket_medio: number;
    }>();

  return results.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    startDate: r.start_date,
    endDate: r.end_date,
    contatosWhatsapp: r.contatos_whatsapp,
    agendamentos: r.agendamentos,
    agendamentosComServico: r.agendamentos_com_servico,
    faturamento: r.faturamento,
    ticketMedio: r.ticket_medio,
  }));
}
