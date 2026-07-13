import type { Totals } from "../csv/aggregate";

export type StrategicOriginType = "manual" | "diagnostic" | "alert" | "decision";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "completed";
export type DecisionStatus = "active" | "reviewed" | "archived";

export const TRACKED_DECISION_METRICS = [
  "spend",
  "results",
  "purchases",
  "conversionValue",
  "roas",
  "cpa",
  "ctr",
  "costPerConversation",
] as const;

export type TrackedDecisionMetric = (typeof TRACKED_DECISION_METRICS)[number];
export type MetricsSnapshot = Record<TrackedDecisionMetric, number>;

export const DECISION_METRIC_LABELS: Record<TrackedDecisionMetric, string> = {
  spend: "Investimento",
  results: "Resultados",
  purchases: "Compras",
  conversionValue: "Faturamento Meta",
  roas: "ROAS",
  cpa: "CPA",
  ctr: "CTR",
  costPerConversation: "Custo por conversa",
};

export interface StrategicOrigin {
  type: StrategicOriginType;
  key?: string | null;
  title?: string | null;
}

export interface StrategicTask extends StrategicOrigin {
  id: number;
  clientId: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  status: TaskStatus;
  originTitle: string | null;
  decisionId: number | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MetricComparison {
  metric: TrackedDecisionMetric;
  baseline: number;
  observed: number;
  difference: number;
  relativeChange: number | null;
}

export interface StrategicDecision extends StrategicOrigin {
  id: number;
  clientId: number;
  title: string;
  rationale: string;
  entityType: string;
  entityName: string | null;
  originTitle: string | null;
  baseline: { start: string; end: string; metrics: MetricsSnapshot };
  evaluation: { start: string; end: string };
  resultNote: string | null;
  status: DecisionStatus;
  createdAt: string;
  observedMetrics: MetricsSnapshot | null;
  comparison: MetricComparison[];
}

export interface StrategicMemory {
  tasks: StrategicTask[];
  decisions: StrategicDecision[];
}

export function snapshotMetrics(totals: Totals): MetricsSnapshot {
  return Object.fromEntries(
    TRACKED_DECISION_METRICS.map((metric) => [metric, totals[metric]]),
  ) as MetricsSnapshot;
}

export function compareMetrics(
  baseline: MetricsSnapshot,
  observed: MetricsSnapshot,
): MetricComparison[] {
  return TRACKED_DECISION_METRICS.map((metric) => {
    const difference = observed[metric] - baseline[metric];
    return {
      metric,
      baseline: baseline[metric],
      observed: observed[metric],
      difference,
      relativeChange: baseline[metric] === 0 ? null : difference / Math.abs(baseline[metric]),
    };
  });
}
