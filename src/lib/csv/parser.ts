import Papa from "papaparse";
import { buildColumnIndex, toNumber, toString, type CanonicalKey } from "./normalize";
import type { AdRow, ParsedDataset } from "./types";
import { parseDate } from "./aggregate";

const NUMERIC_KEYS: CanonicalKey[] = [
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "results",
  "costPerResult",
  "purchases",
  "cpa",
  "conversionValue",
  "roas",
  "conversations",
  "costPerConversation",
  "videoPlays",
  "thruplays",
  "video25",
  "video50",
  "video75",
  "video95",
  "engagement",
  "reactions",
  "comments",
  "shares",
  "budget",
  "averageConversionValue",
];

const STRING_KEYS: CanonicalKey[] = [
  "campaignName",
  "adSetName",
  "adName",
  "date",
  "endDate",
  "objective",
  "resultIndicator",
  "resultUnit",
  "delivery",
  "budgetType",
  "attribution",
];

// Reconstrói um ParsedDataset a partir de linhas já processadas (vindas do banco).
// As linhas salvas já passaram pela agregação/derivação do parseCsvFile, então aqui
// só recompomos os metadados (colunas reconhecidas, métricas disponíveis, flags).
export function datasetFromRows(rows: AdRow[], fileName: string): ParsedDataset {
  const headers = rows.length ? Object.keys(rows[0].rawData ?? {}) : [];
  const { index, recognized, unrecognized } = buildColumnIndex(headers);
  const availableMetrics = (Object.keys(index) as CanonicalKey[]).filter((k) =>
    NUMERIC_KEYS.includes(k),
  );
  const missingMetrics = NUMERIC_KEYS.filter((k) => !index[k]);
  return {
    fileName,
    rows,
    totalRows: rows.length,
    totalColumns: headers.length,
    recognizedColumns: recognized,
    unrecognizedColumns: unrecognized,
    availableMetrics,
    missingMetrics,
    hasDate: !!index.date,
    hasCampaign: !!index.campaignName,
    hasAdSet: !!index.adSetName,
    hasAd: !!index.adName,
  };
}

export async function parseCsvFile(file: File): Promise<ParsedDataset> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        try {
          const data = results.data.filter((r) => r && Object.keys(r).length > 0);
          const headers = results.meta.fields ?? [];
          const { index, recognized, unrecognized } = buildColumnIndex(headers);

          const rawRows = data.map((raw) => {
            const row = {} as AdRow;
            row.rawData = { ...raw }; // Salva cópia fiel dos dados originais
            for (const k of STRING_KEYS) {
              const col = index[k];
              let val = col ? toString(raw[col]) : "";

              // Normalização de Datas para padrão brasileiro DD/MM/AAAA
              if ((k === "date" || k === "endDate") && val) {
                const timestamp = parseDate(val);
                if (timestamp > 0) {
                  const d = new Date(timestamp);
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const yyyy = d.getFullYear();
                  val = `${dd}/${mm}/${yyyy}`;
                }
              }

              (row as unknown as Record<string, string>)[k] = val;
            }
            for (const k of NUMERIC_KEYS) {
              const col = index[k];
              (row as unknown as Record<string, number>)[k] = col ? toNumber(raw[col]) : 0;
            }

            // Inteligência de distribuição de Resultados / Leads
            const indicator = (row.resultIndicator || "").toLowerCase();
            const unit = (row.resultUnit || "").toLowerCase();

            // Detecção agressiva de Compras/Vendas
            const seemsLikePurchase =
              indicator.includes("compra") ||
              indicator.includes("purchase") ||
              indicator.includes("venda") ||
              unit.includes("compra") ||
              unit.includes("purchase") ||
              unit.includes("venda") ||
              row.conversionValue > 0 ||
              row.roas > 0 ||
              row.cpa > 0;

            if (seemsLikePurchase) {
              if (row.purchases === 0 && row.results > 0) {
                row.purchases = row.results;
              }
              if (row.conversionValue === 0 && row.results > 0 && row.roas > 0) {
                row.conversionValue = row.spend * row.roas;
              }
            }

            // Detecção agressiva de Conversas/Leads
            const seemsLikeLead =
              indicator.includes("conversa") ||
              indicator.includes("messaging") ||
              indicator.includes("lead") ||
              indicator.includes("cadastro") ||
              indicator.includes("conversas por mensagem iniciadas") ||
              unit.includes("conversa") ||
              unit.includes("messaging") ||
              unit.includes("lead") ||
              unit.includes("cadastro") ||
              unit.includes("conversas por mensagem iniciadas");

            if (seemsLikeLead) {
              if (row.conversations === 0 && row.results > 0) {
                row.conversations = row.results;
              }
            }

            return row;
          });

          // Agrupamento por Data e Campanha para evitar duplicidade em relatórios detalhados
          const groupedMap = new Map<string, AdRow>();

          for (const r of rawRows) {
            const groupKey = `${r.date}_${r.campaignName}`;
            const existing = groupedMap.get(groupKey);

            if (existing) {
              existing.spend += r.spend;
              existing.impressions += r.impressions;
              existing.reach += r.reach;
              existing.clicks += r.clicks;
              existing.results += r.results;
              existing.purchases += r.purchases;
              existing.conversations += r.conversations;
              existing.conversionValue += r.conversionValue;
              existing.videoPlays += r.videoPlays;
              existing.thruplays += r.thruplays;
              existing.video25 += r.video25;
              existing.video50 += r.video50;
              existing.video75 += r.video75;
              existing.video95 += r.video95;
              existing.engagement += r.engagement;
              existing.reactions += r.reactions;
              existing.comments += r.comments;
              existing.shares += r.shares;
              // Orçamento e Atribuição: mantém o primeiro ou maior
              existing.budget = Math.max(existing.budget, r.budget);
            } else {
              groupedMap.set(groupKey, { ...r });
            }
          }

          const rows = Array.from(groupedMap.values()).filter((r) => {
            const totalLike = (r.campaignName || "").toLowerCase();
            return !["total", "totals", "grand total"].includes(totalLike);
          });

          const availableMetrics = (Object.keys(index) as CanonicalKey[]).filter((k) =>
            NUMERIC_KEYS.includes(k),
          );
          const missingMetrics = NUMERIC_KEYS.filter((k) => !index[k]);

          // Recalcula métricas derivadas para cada linha agrupada
          for (const r of rows) {
            // Engenharia reversa de métricas básicas se necessário
            if (r.clicks === 0 && r.impressions > 0 && r.ctr > 0)
              r.clicks = Math.round(r.impressions * (r.ctr / 100));
            if (r.impressions === 0 && r.clicks > 0 && r.ctr > 0)
              r.impressions = Math.round(r.clicks / (r.ctr / 100));
            if (r.spend === 0 && r.clicks > 0 && r.cpc > 0) r.spend = r.clicks * r.cpc;
            if (r.spend === 0 && r.impressions > 0 && r.cpm > 0)
              r.spend = (r.impressions / 1000) * r.cpm;

            // Cálculos forçados de performance (Funil)
            if (r.impressions > 0) {
              r.ctr = (r.clicks / r.impressions) * 100;
              r.cpm = (r.spend / r.impressions) * 1000;
            }
            if (r.clicks > 0) {
              r.cpc = r.spend / r.clicks;
            }
            if (r.reach > 0) {
              r.frequency = r.impressions / r.reach;
            }

            // Inteligência de Vendas (Ticket Médio / Faturamento)
            if (r.conversionValue === 0 && r.purchases > 0 && r.averageConversionValue > 0) {
              r.conversionValue = r.purchases * r.averageConversionValue;
            }
            if (r.purchases === 0 && r.conversionValue > 0 && r.averageConversionValue > 0) {
              r.purchases = Math.round(r.conversionValue / r.averageConversionValue);
            }

            if (r.roas === 0 && r.spend > 0 && r.conversionValue > 0)
              r.roas = r.conversionValue / r.spend;
            if (r.cpa === 0 && r.purchases > 0) r.cpa = r.spend / r.purchases;
            if (r.costPerConversation === 0 && r.conversations > 0)
              r.costPerConversation = r.spend / r.conversations;
          }

          resolve({
            fileName: file.name,
            rows,
            totalRows: rows.length,
            totalColumns: headers.length,
            recognizedColumns: recognized,
            unrecognizedColumns: unrecognized,
            availableMetrics,
            missingMetrics,
            hasDate: !!index.date,
            hasCampaign: !!index.campaignName,
            hasAdSet: !!index.adSetName,
            hasAd: !!index.adName,
          });
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}
