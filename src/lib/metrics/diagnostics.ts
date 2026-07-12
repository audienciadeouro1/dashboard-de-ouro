import type { Totals } from "../csv/aggregate";

export type GoalMetric = "cpa" | "roas" | "ctr" | "costPerConversation" | "frequency";
export type Severity = "info" | "atencao" | "critico";
export type DiagnosticStatus = "open" | "acknowledged" | "resolved";
export type Confidence = "alta" | "media" | "baixa";

export interface Goal {
  id?: number;
  clientId: number;
  metric: GoalMetric;
  target: number | null;
  limitValue: number | null;
  active: boolean;
}

export interface Diagnostic {
  id?: number;
  ruleKey: string;
  title: string;
  category: string;
  severity: Severity;
  fact: string;
  evidence: string;
  hypothesis: string;
  recommendation: string;
  confidence: Confidence;
  period: { start: string | null; end: string | null };
  status: DiagnosticStatus;
}

export interface Alert {
  id?: number;
  ruleKey: string;
  title: string;
  severity: Severity;
  metric: GoalMetric | "dataFreshness";
  value: number;
  threshold: number;
  period: { start: string | null; end: string | null };
  status: DiagnosticStatus;
}

export interface DiagnosticsInput {
  totals: Totals;
  previousTotals?: Totals;
  qualityLevel?: "ok" | "atencao" | "problema";
  qualityMessage?: string;
  goals: Goal[];
  period: { start: string | null; end: string | null };
}

function metricValue(totals: Totals, metric: GoalMetric): number {
  return totals[metric];
}

function periodText(period: DiagnosticsInput["period"]): string {
  return period.start && period.end ? `${period.start} a ${period.end}` : "período selecionado";
}

function base(ruleKey: string, period: DiagnosticsInput["period"]): Pick<Diagnostic, "ruleKey" | "period" | "status"> {
  return { ruleKey, period, status: "open" };
}

export function evaluateDiagnostics(input: DiagnosticsInput): { diagnostics: Diagnostic[]; alerts: Alert[] } {
  const diagnostics: Diagnostic[] = [];
  const alerts: Alert[] = [];
  const { totals, goals, period } = input;
  const label = periodText(period);

  for (const goal of goals.filter((g) => g.active)) {
    const value = metricValue(totals, goal.metric);
    if (goal.limitValue !== null && value > goal.limitValue && value > 0) {
      const ruleKey = `${goal.metric}_above_limit`;
      diagnostics.push({
        ...base(ruleKey, period), title: `${goal.metric.toUpperCase()} acima do limite`, category: "meta",
        severity: "critico", fact: `O ${goal.metric} ficou em ${value.toFixed(2)} no ${label}.`,
        evidence: `Limite configurado para este cliente: ${goal.limitValue.toFixed(2)}.`,
        hypothesis: "O custo ou a eficiência está fora do patamar definido para esta operação.",
        recommendation: "Investigar campanhas e conjuntos que concentram verba antes de alterar a estratégia.", confidence: "alta",
      });
      alerts.push({ ...base(ruleKey, period), title: `${goal.metric.toUpperCase()} acima do limite`, severity: "critico", metric: goal.metric, value, threshold: goal.limitValue });
    }
    if (goal.target !== null && ((goal.metric === "roas" && value < goal.target) || (goal.metric !== "roas" && value < goal.target && value > 0))) {
      const ruleKey = `${goal.metric}_below_target`;
      diagnostics.push({
        ...base(ruleKey, period), title: `${goal.metric.toUpperCase()} abaixo da meta`, category: "meta",
        severity: "atencao", fact: `O ${goal.metric} ficou em ${value.toFixed(2)} no ${label}.`,
        evidence: `Meta configurada para este cliente: ${goal.target.toFixed(2)}.`,
        hypothesis: "A entrega atual não está atingindo o resultado esperado pelo gestor.",
        recommendation: "Comparar com o período anterior e priorizar a entidade com maior impacto no desvio.", confidence: "alta",
      });
      alerts.push({ ...base(ruleKey, period), title: `${goal.metric.toUpperCase()} abaixo da meta`, severity: "atencao", metric: goal.metric, value, threshold: goal.target });
    }
  }

  if (input.previousTotals && input.previousTotals.ctr > 0 && totals.ctr < input.previousTotals.ctr * 0.8) {
    const change = ((totals.ctr - input.previousTotals.ctr) / input.previousTotals.ctr) * 100;
    const ruleKey = "ctr_decline";
    diagnostics.push({
      ...base(ruleKey, period), title: "CTR em queda", category: "tendência", severity: "atencao",
      fact: `O CTR caiu ${Math.abs(change).toFixed(1)}% contra o período anterior.`,
      evidence: `CTR atual: ${totals.ctr.toFixed(2)}%; anterior: ${input.previousTotals.ctr.toFixed(2)}%.`,
      hypothesis: "Criativos ou públicos podem estar perdendo capacidade de gerar cliques.",
      recommendation: "Revisar criativos, ângulos de copy e frequência antes de aumentar investimento.", confidence: "media",
    });
    alerts.push({ ...base(ruleKey, period), title: "CTR em queda", severity: "atencao", metric: "ctr", value: totals.ctr, threshold: input.previousTotals.ctr * 0.8 });
  }

  if (input.qualityLevel && input.qualityLevel !== "ok") {
    const ruleKey = "data_quality";
    diagnostics.push({
      ...base(ruleKey, period), title: "Qualidade dos dados requer atenção", category: "dados",
      severity: input.qualityLevel === "problema" ? "critico" : "atencao",
      fact: "O período possui sinais de cobertura ou atualização insuficiente.",
      evidence: input.qualityMessage ?? "Consulte a aba Qualidade dos Dados para ver os detalhes.",
      hypothesis: "Conclusões sobre performance podem estar distorcidas por dados incompletos ou atrasados.",
      recommendation: "Atualizar o CSV antes de tomar decisões de otimização.", confidence: "alta",
    });
    alerts.push({ ...base(ruleKey, period), title: "Qualidade dos dados requer atenção", severity: input.qualityLevel === "problema" ? "critico" : "atencao", metric: "dataFreshness", value: input.qualityLevel === "problema" ? 0 : 1, threshold: 1 });
  }

  return { diagnostics, alerts };
}
