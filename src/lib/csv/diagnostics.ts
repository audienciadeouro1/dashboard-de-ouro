import type { Aggregated, Totals } from "./aggregate";
import type { AnalysisMode } from "./types";

export type Status = "scale" | "optimize" | "pause" | "monitor" | "insufficient";

export interface DiagnosedCampaign extends Aggregated {
  status: Status;
  reason: string;
}

export const STATUS_LABELS: Record<Status, string> = {
  scale: "Escalar",
  optimize: "Otimizar",
  pause: "Pausar",
  monitor: "Monitorar",
  insufficient: "Dados insuficientes",
};

function primaryMetric(mode: AnalysisMode, a: Aggregated): { value: number; cost: number } {
  switch (mode) {
    case "sales":
      // Em vendas, priorizamos compras reais. Se não houver, não devemos assumir que 'resultados' são vendas
      // a menos que o parser já tenha feito essa ponte (o que ele faz via indicador de resultados).
      return { value: a.purchases, cost: a.cpa };
    case "leads":
      return {
        value: a.conversations,
        cost: a.costPerConversation,
      };
    case "video":
      return { value: a.thruplays, cost: a.costPerThruplay };
    case "engagement":
      return {
        value: a.engagement || a.clicks,
        cost: a.spend / Math.max(1, a.engagement || a.clicks),
      };
    case "awareness":
      return { value: a.reach, cost: a.cpm };
    default:
      return { value: a.results || a.clicks, cost: a.costPerResult || a.cpc };
  }
}

export function diagnoseCampaigns(
  campaigns: Aggregated[],
  totals: Totals,
  mode: AnalysisMode,
): DiagnosedCampaign[] {
  if (campaigns.length === 0) return [];

  // Custo médio (entre as que têm resultado)
  const costs = campaigns.map((c) => primaryMetric(mode, c).cost).filter((c) => c > 0);
  const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
  const totalSpend = totals.spend || 1;

  return campaigns.map((c) => {
    const { value, cost } = primaryMetric(mode, c);
    const spendShare = c.spend / totalSpend;

    if (c.spend < totalSpend * 0.01 && value < 1) {
      return { ...c, status: "insufficient", reason: "Volume muito baixo para tirar conclusões." };
    }

    // Vendas: usa ROAS quando disponível
    if (mode === "sales" && c.roas > 0) {
      if (c.roas >= 3 && c.spend > totalSpend * 0.05)
        return {
          ...c,
          status: "scale",
          reason: `ROAS de ${c.roas.toFixed(2)}x acima da média — oportunidade de escala.`,
        };
      if (c.roas < 1 && c.spend > totalSpend * 0.05)
        return {
          ...c,
          status: "pause",
          reason: `ROAS de ${c.roas.toFixed(2)}x abaixo do investimento — considere pausar.`,
        };
      if (c.roas < 2)
        return {
          ...c,
          status: "optimize",
          reason: `ROAS de ${c.roas.toFixed(2)}x pode ser melhorado.`,
        };
      return { ...c, status: "monitor", reason: `ROAS saudável de ${c.roas.toFixed(2)}x.` };
    }

    if (value === 0 && c.spend > totalSpend * 0.05) {
      return {
        ...c,
        status: "pause",
        reason: "Consumiu orçamento relevante sem gerar resultados.",
      };
    }

    if (cost > 0 && avgCost > 0) {
      if (cost <= avgCost * 0.7 && spendShare > 0.05)
        return {
          ...c,
          status: "scale",
          reason: `Custo ${(((avgCost - cost) / avgCost) * 100).toFixed(0)}% abaixo da média.`,
        };
      if (cost >= avgCost * 1.5)
        return {
          ...c,
          status: "optimize",
          reason: `Custo ${(((cost - avgCost) / avgCost) * 100).toFixed(0)}% acima da média.`,
        };
    }

    if (c.ctr > 0 && c.ctr < 0.5)
      return { ...c, status: "optimize", reason: "CTR baixo — sugere revisar criativo ou copy." };

    if (c.frequency > 4 && c.ctr < 1)
      return {
        ...c,
        status: "optimize",
        reason: "Frequência alta com CTR baixo — possível saturação.",
      };

    return { ...c, status: "monitor", reason: "Performance dentro da média." };
  });
}

export interface AccountDiagnosis {
  score: number;
  scoreLabel: string;
  summary: string;
  strengths: string[];
  warnings: string[];
  opportunities: string[];
}

export function diagnoseAccount(
  totals: Totals,
  campaigns: DiagnosedCampaign[],
  mode: AnalysisMode,
): AccountDiagnosis {
  let score = 50;
  const strengths: string[] = [];
  const warnings: string[] = [];
  const opportunities: string[] = [];

  const scaleCount = campaigns.filter((c) => c.status === "scale").length;
  const pauseCount = campaigns.filter((c) => c.status === "pause").length;
  const optimizeCount = campaigns.filter((c) => c.status === "optimize").length;

  if (mode === "sales") {
    if (totals.roas >= 3) {
      score += 25;
      strengths.push(`ROAS geral de ${totals.roas.toFixed(2)}x — excelente retorno.`);
    } else if (totals.roas >= 2) {
      score += 15;
      strengths.push(`ROAS geral de ${totals.roas.toFixed(2)}x — bom desempenho.`);
    } else if (totals.roas >= 1) {
      score += 5;
      warnings.push(`ROAS de ${totals.roas.toFixed(2)}x — operação no limite.`);
    } else if (totals.roas > 0) {
      score -= 15;
      warnings.push(`ROAS de ${totals.roas.toFixed(2)}x — operação deficitária.`);
    }
  }

  if (mode === "leads" && totals.costPerConversation > 0) {
    if (totals.costPerConversation < 5) {
      score += 20;
      strengths.push(
        `Custo por conversa de ${totals.costPerConversation.toFixed(2)} — muito eficiente.`,
      );
    } else if (totals.costPerConversation > 30) {
      score -= 10;
      warnings.push(`Custo por conversa elevado.`);
    }
  }

  if (totals.ctr >= 1.5) {
    score += 10;
    strengths.push(`CTR médio de ${totals.ctr.toFixed(2)}% — criativos engajadores.`);
  } else if (totals.ctr < 0.5 && totals.ctr > 0) {
    score -= 10;
    warnings.push(`CTR médio baixo (${totals.ctr.toFixed(2)}%) — revisar criativos.`);
  }

  if (totals.frequency > 4) {
    score -= 5;
    warnings.push(`Frequência geral alta (${totals.frequency.toFixed(1)}x) — risco de saturação.`);
  }

  if (scaleCount > 0)
    opportunities.push(
      `${scaleCount} campanha${scaleCount > 1 ? "s" : ""} pronta${scaleCount > 1 ? "s" : ""} para escalar com mais orçamento.`,
    );
  if (pauseCount > 0)
    warnings.push(
      `${pauseCount} campanha${pauseCount > 1 ? "s" : ""} consumindo verba sem retorno.`,
    );
  if (optimizeCount > 0)
    opportunities.push(
      `${optimizeCount} campanha${optimizeCount > 1 ? "s" : ""} com potencial de otimização.`,
    );

  score = Math.max(0, Math.min(100, score));

  let scoreLabel = "Crítico";
  if (score >= 80) scoreLabel = "Excelente";
  else if (score >= 65) scoreLabel = "Bom";
  else if (score >= 45) scoreLabel = "Regular";
  else if (score >= 25) scoreLabel = "Atenção";

  const summary =
    score >= 65
      ? "A conta apresenta boa performance geral. Foque em escalar o que está funcionando e otimizar os gargalos identificados."
      : score >= 45
        ? "A conta tem performance mediana com espaço relevante para otimização. Priorize ajustes de criativo e realocação de verba."
        : "A conta apresenta sinais críticos. Recomenda-se revisão estrutural de campanhas, públicos e criativos.";

  return { score, scoreLabel, summary, strengths, warnings, opportunities };
}
