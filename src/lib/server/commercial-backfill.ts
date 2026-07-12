import type { D1Database } from "@cloudflare/workers-types";
import type { FunnelConfig } from "../csv/types";
import { getExternalWeeklyData } from "./external";
import { upsertCommercialPeriods, type CommercialPeriodInput } from "./commercial";
import { saveFunnelConfig } from "./funnel-config";

export const MARIA_MARIA_FUNNEL: FunnelConfig = {
  metaStages: [
    { key: "impressions", label: "Impressões" },
    { key: "clicks", label: "Cliques" },
    { key: "conversations", label: "Conversas iniciadas" },
  ],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [
      { key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" },
      { key: "agendamentos", label: "Agendamentos", column: "Agendamentos" },
      { key: "vendas", label: "Vendas", column: "Agendamentos com serviço" },
    ],
  },
};

function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export async function backfillCommercialFromExternal(
  db: D1Database,
  clientId: number,
): Promise<{ periods: number }> {
  const weeks = await getExternalWeeklyData(db, clientId);
  const periods: CommercialPeriodInput[] = weeks.map((w) => {
    const semana = `${formatDayMonth(w.startDate)} a ${formatDayMonth(w.endDate)}`;
    return {
      startDate: w.startDate,
      endDate: w.endDate,
      label: semana,
      row: {
        Semana: semana,
        "Contatos Whatsapp": String(w.contatosWhatsapp),
        Agendamentos: String(w.agendamentos),
        "Agendamentos com serviço": String(w.agendamentosComServico),
        TM: String(w.ticketMedio),
        Total: String(w.faturamento),
      },
    };
  });
  const saved = await upsertCommercialPeriods(db, clientId, periods);
  await saveFunnelConfig(db, clientId, MARIA_MARIA_FUNNEL);
  return { periods: saved };
}
