import Papa from "papaparse";
import { buildColumnIndex, toNumber, toString, type CanonicalKey } from "./normalize";
import type { AdRow, ParsedDataset } from "./types";

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
];

const STRING_KEYS: CanonicalKey[] = [
  "campaignName",
  "adSetName",
  "adName",
  "date",
  "objective",
  "resultIndicator",
  "resultUnit",
];

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

          const rows: AdRow[] = data
            .map((raw) => {
              const row = {} as AdRow;
              for (const k of STRING_KEYS) {
                const col = index[k];
                (row as unknown as Record<string, string>)[k] = col ? toString(raw[col]) : "";
              }
              for (const k of NUMERIC_KEYS) {
                const col = index[k];
                (row as unknown as Record<string, number>)[k] = col ? toNumber(raw[col]) : 0;
              }

              // Inteligência de distribuição de Resultados
              const indicator = row.resultIndicator.toLowerCase();
              const unit = row.resultUnit.toLowerCase();

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
                unit.includes("conversa") ||
                unit.includes("messaging") ||
                unit.includes("lead") ||
                unit.includes("cadastro");

              if (seemsLikeLead && row.conversations === 0 && row.results > 0) {
                row.conversations = row.results;
              }

              return row;
            })
            .filter((r) => {
              const totalLike = (r.campaignName || "").toLowerCase();
              return !["total", "totals", "grand total"].includes(totalLike);
            });

          const availableMetrics = (Object.keys(index) as CanonicalKey[]).filter((k) =>
            NUMERIC_KEYS.includes(k),
          );
          const missingMetrics = NUMERIC_KEYS.filter((k) => !index[k]);

          // Recalcula métricas derivadas se estiverem zeradas e houver dados para calcular
          for (const r of rows) {
            // Engenharia reversa de métricas básicas se necessário
            if (r.clicks === 0 && r.impressions > 0 && r.ctr > 0)
              r.clicks = Math.round(r.impressions * (r.ctr / 100));
            if (r.impressions === 0 && r.clicks > 0 && r.ctr > 0)
              r.impressions = Math.round(r.clicks / (r.ctr / 100));
            if (r.spend === 0 && r.clicks > 0 && r.cpc > 0) r.spend = r.clicks * r.cpc;
            if (r.spend === 0 && r.impressions > 0 && r.cpm > 0)
              r.spend = (r.impressions / 1000) * r.cpm;

            // Cálculos forçados de performance
            if (r.ctr === 0 && r.impressions > 0) r.ctr = (r.clicks / r.impressions) * 100;
            if (r.cpc === 0 && r.clicks > 0) r.cpc = r.spend / r.clicks;
            if (r.cpm === 0 && r.impressions > 0) r.cpm = (r.spend / r.impressions) * 1000;
            if (r.frequency === 0 && r.reach > 0) r.frequency = r.impressions / r.reach;
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
