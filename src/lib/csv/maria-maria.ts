import Papa from "papaparse";
import { toNumber } from "./normalize";
import type { ParsedDataset, MariaMariaRow, MariaMariaDataset, AdRow } from "./types";
import { parseDate } from "./aggregate";

export async function processMariaMaria(
  metaDataset: ParsedDataset,
  salonFile: File,
): Promise<MariaMariaDataset> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(salonFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const salonData = results.data;
          const weeks: MariaMariaRow[] = [];

          // Detecção de Relatório Consolidado (Total Geral do período semestral/mensal)
          // Se houver poucas linhas e as datas de início/fim forem diferentes, é um acumulado.
          const isConsolidated =
            metaDataset.rows.length < 50 && metaDataset.rows.some((r) => r.date !== r.endDate);

          const reportRange = { start: Infinity, end: -Infinity };
          const metaTotals = {
            spend: 0,
            impressions: 0,
            reach: 0,
            clicks: 0,
            conversations: 0,
            ctrSum: 0,
            ctrTodosSum: 0,
            cpmSum: 0,
            frequencySum: 0,
            count: 0,
          };

          for (const r of metaDataset.rows) {
            const s = parseDate(r.date);
            const e = parseDate(r.endDate);
            if (s > 0 && s < reportRange.start) reportRange.start = s;
            if (e > 0 && e > reportRange.end) reportRange.end = e;

            metaTotals.spend += r.spend;
            metaTotals.impressions += r.impressions;
            metaTotals.reach += r.reach;
            metaTotals.clicks += r.clicks;
            metaTotals.conversations += r.conversations;
            metaTotals.ctrSum += r.ctr * r.impressions;
            metaTotals.ctrTodosSum += (r.ctrTodos || 0) * r.impressions;
            metaTotals.cpmSum += r.cpm * r.impressions;
            metaTotals.frequencySum += r.frequency * r.impressions;
            metaTotals.count += r.impressions;
          }

          const totalReportDays =
            reportRange.start < Infinity
              ? Math.round((reportRange.end - reportRange.start) / (24 * 3600 * 1000)) + 1
              : 1;

          // Identifica o ano base a partir do dataset do Meta (ou ano atual)
          const metaYear =
            metaDataset.rows.length > 0
              ? new Date(parseDate(metaDataset.rows[0].date)).getFullYear()
              : new Date().getFullYear();

          for (const row of salonData) {
            const semanaText = row["Semana"] || row["semana"];
            if (!semanaText) continue;

            const dates = parseSemana(semanaText, metaYear);
            if (!dates) continue;

            const { start, end } = dates;
            let finalMetaData;

            if (isConsolidated) {
              // REGRA DE CONTINGÊNCIA: Distribuição Média Proporcional
              // Calculamos quantos dias desta semana do salão caem dentro do intervalo do Meta
              const overlapStart = Math.max(start, reportRange.start);
              const overlapEnd = Math.min(end, reportRange.end);
              const overlapDays =
                overlapStart <= overlapEnd
                  ? Math.round((overlapEnd - overlapStart) / (24 * 3600 * 1000)) + 1
                  : 0;

              const proportion = overlapDays / totalReportDays;
              const totalWeight = metaTotals.count || 1;

              finalMetaData = {
                spend: metaTotals.spend * proportion,
                impressions: Math.round(metaTotals.impressions * proportion),
                reach: Math.round(metaTotals.reach * proportion),
                frequency: metaTotals.frequencySum / totalWeight,
                ctr: metaTotals.ctrSum / totalWeight,
                ctrTodos: metaTotals.ctrTodosSum / totalWeight,
                cpm: metaTotals.cpmSum / totalWeight,
                conversations: Math.round(metaTotals.conversations * proportion),
                clicks: Math.round(metaTotals.clicks * proportion),
                cpl: 0,
              };
              finalMetaData.cpl =
                finalMetaData.conversations > 0
                  ? finalMetaData.spend / finalMetaData.conversations
                  : 0;
            } else {
              // Filtra Meta Ads por esse intervalo (Comportamento Diário Padrão)
              const metaRows = metaDataset.rows.filter((r) => {
                const d = parseDate(r.date);
                return d >= start && d <= end;
              });

              // Agregação Meta
              const metaAgg = {
                spend: 0,
                impressions: 0,
                reach: 0,
                clicks: 0,
                conversations: 0,
                ctrSum: 0,
                ctrTodosSum: 0,
                cpmSum: 0,
                frequencySum: 0,
                count: 0,
              };

              for (const mr of metaRows) {
                metaAgg.spend += mr.spend;
                metaAgg.impressions += mr.impressions;
                metaAgg.reach += mr.reach;
                metaAgg.clicks += mr.clicks;
                metaAgg.conversations += mr.conversations;
                metaAgg.ctrSum += mr.ctr * mr.impressions; // Média ponderada
                metaAgg.ctrTodosSum += (mr.ctrTodos || 0) * mr.impressions;
                metaAgg.cpmSum += mr.cpm * mr.impressions;
                metaAgg.frequencySum += mr.frequency * mr.impressions;
                metaAgg.count += mr.impressions;
              }

              const totalImpressions = metaAgg.count || 1;

              finalMetaData = {
                spend: metaAgg.spend,
                impressions: metaAgg.impressions,
                reach: metaAgg.reach,
                frequency: metaAgg.frequencySum / totalImpressions,
                ctr: metaAgg.ctrSum / totalImpressions,
                ctrTodos: metaAgg.ctrTodosSum / totalImpressions,
                cpm: metaAgg.cpmSum / totalImpressions,
                conversations: metaAgg.conversations,
                clicks: metaAgg.clicks,
                cpl: metaAgg.conversations > 0 ? metaAgg.spend / metaAgg.conversations : 0,
              };
            }

            const faturamento = toNumber(row["Total"] || row["total"]);
            const agendamentosComServico = toNumber(
              row["Agendamentos com serviço"] || row["agendamentos_com_servico"],
            );
            const contatosWhatsapp = toNumber(row["Contatos Whatsapp"] || row["contatos_whatsapp"]);

            const mmRow: MariaMariaRow = {
              semana: semanaText,
              startDate: start,
              endDate: end,
              salonData: {
                contatosWhatsapp,
                agendamentos: toNumber(row["Agendamentos"] || row["agendamentos"]),
                agendamentosComServico,
                totalFaturamento: faturamento,
                ticketMedio: toNumber(row["TM"] || row["tm"]),
              },
              metaData: finalMetaData,
              roasReal: finalMetaData.spend > 0 ? faturamento / finalMetaData.spend : 0,
              cacReal:
                agendamentosComServico > 0 ? finalMetaData.spend / agendamentosComServico : 0,
              taxaConversaoReal:
                contatosWhatsapp > 0 ? (agendamentosComServico / contatosWhatsapp) * 100 : 0,
            };

            weeks.push(mmRow);
          }

          resolve({
            weeks: weeks.sort((a, b) => a.startDate - b.startDate),
            metaDataset,
          });
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

function parseSemana(text: string, year: number): { start: number; end: number } | null {
  // Formato esperado: "19/04 a 25/04"
  const parts = text.split(/ a | /i).filter((p) => p.includes("/"));
  if (parts.length < 2) return null;

  const [d1, m1] = parts[0].split("/").map((n) => parseInt(n));
  const [d2, m2] = parts[1].split("/").map((n) => parseInt(n));

  if (isNaN(d1) || isNaN(m1) || isNaN(d2) || isNaN(m2)) return null;

  // Trata virada de ano se necessário (ex: 28/12 a 03/01)
  let yearEnd = year;
  if (m2 < m1) yearEnd = year + 1;

  const start = new Date(year, m1 - 1, d1).getTime();
  const end = new Date(yearEnd, m2 - 1, d2, 23, 59, 59).getTime();

  return { start, end };
}
