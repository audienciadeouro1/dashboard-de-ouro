import type { D1Database } from "@cloudflare/workers-types";
import { getInsights } from "./insights";
import { totals } from "../csv/aggregate";
import {
  compareMetrics,
  snapshotMetrics,
  type DecisionStatus,
  type MetricsSnapshot,
  type StrategicDecision,
  type StrategicMemory,
  type StrategicOriginType,
  type StrategicTask,
  type TaskPriority,
  type TaskStatus,
} from "../metrics/strategic-memory";

interface TaskRow {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  status: TaskStatus;
  origin_type: StrategicOriginType;
  origin_key: string | null;
  origin_title: string | null;
  decision_id: number | null;
  completed_at: string | null;
  created_at: string;
}

interface DecisionRow {
  id: number;
  client_id: number;
  title: string;
  rationale: string;
  entity_type: string;
  entity_name: string | null;
  origin_type: Exclude<StrategicOriginType, "decision">;
  origin_key: string | null;
  origin_title: string | null;
  baseline_start: string;
  baseline_end: string;
  baseline_metrics_json: string;
  evaluation_start: string;
  evaluation_end: string;
  result_note: string | null;
  status: DecisionStatus;
  created_at: string;
}

export interface CreateTaskInput {
  clientId: number;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  origin?: { type: StrategicOriginType; key?: string | null; title?: string | null };
  decisionId?: number | null;
}

export interface CreateDecisionInput {
  clientId: number;
  title: string;
  rationale: string;
  entityType?: string;
  entityName?: string | null;
  origin?: {
    type: Exclude<StrategicOriginType, "decision">;
    key?: string | null;
    title?: string | null;
  };
  baselineStart: string;
  baselineEnd: string;
  evaluationStart: string;
  evaluationEnd: string;
}

function cleanRequired(value: string, label: string): string {
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`${label} é obrigatório.`);
  return cleaned;
}

function cleanOptional(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function ensureRange(start: string, end: string, label: string): void {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) {
    throw new Error(`O período de ${label} é inválido.`);
  }
}

function parseSnapshot(raw: string): MetricsSnapshot {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Foto de métricas inválida.");
  const value = parsed as Partial<MetricsSnapshot>;
  return {
    spend: Number(value.spend) || 0,
    results: Number(value.results) || 0,
    purchases: Number(value.purchases) || 0,
    conversionValue: Number(value.conversionValue) || 0,
    roas: Number(value.roas) || 0,
    cpa: Number(value.cpa) || 0,
    ctr: Number(value.ctr) || 0,
    costPerConversation: Number(value.costPerConversation) || 0,
  };
}

function toTask(row: TaskRow): StrategicTask {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    type: row.origin_type,
    key: row.origin_key,
    originTitle: row.origin_title,
    decisionId: row.decision_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  } as StrategicTask;
}

function taskFromRow(row: TaskRow): StrategicTask {
  return toTask(row);
}

function baseDecision(row: DecisionRow): Omit<StrategicDecision, "observedMetrics" | "comparison"> {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    rationale: row.rationale,
    entityType: row.entity_type,
    entityName: row.entity_name,
    type: row.origin_type,
    key: row.origin_key,
    originTitle: row.origin_title,
    baseline: {
      start: row.baseline_start,
      end: row.baseline_end,
      metrics: parseSnapshot(row.baseline_metrics_json),
    },
    evaluation: { start: row.evaluation_start, end: row.evaluation_end },
    resultNote: row.result_note,
    status: row.status,
    createdAt: row.created_at,
  } as Omit<StrategicDecision, "observedMetrics" | "comparison">;
}

const TASK_COLS =
  "id, client_id, title, description, priority, due_date, status, origin_type, origin_key, origin_title, decision_id, completed_at, created_at";
const DECISION_COLS =
  "id, client_id, title, rationale, entity_type, entity_name, origin_type, origin_key, origin_title, baseline_start, baseline_end, baseline_metrics_json, evaluation_start, evaluation_end, result_note, status, created_at";

export async function listStrategicTasks(
  db: D1Database,
  clientId: number,
): Promise<StrategicTask[]> {
  const { results } = await db
    .prepare(
      `SELECT ${TASK_COLS} FROM tasks WHERE client_id = ? ORDER BY status ASC, due_date IS NULL, due_date ASC, created_at DESC LIMIT 100`,
    )
    .bind(clientId)
    .all<TaskRow>();
  return results.map(taskFromRow);
}

export async function createStrategicTask(
  db: D1Database,
  input: CreateTaskInput,
): Promise<StrategicTask> {
  const title = cleanRequired(input.title, "Título da tarefa");
  if (!["low", "medium", "high"].includes(input.priority)) throw new Error("Prioridade inválida.");
  if (input.dueDate && !isIsoDate(input.dueDate)) throw new Error("Prazo inválido.");
  const origin = input.origin ?? { type: "manual" as const };
  const row = await db
    .prepare(
      `INSERT INTO tasks (client_id, title, description, priority, due_date, origin_type, origin_key, origin_title, decision_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING ${TASK_COLS}`,
    )
    .bind(
      input.clientId,
      title,
      cleanOptional(input.description),
      input.priority,
      input.dueDate ?? null,
      origin.type,
      cleanOptional(origin.key),
      cleanOptional(origin.title),
      input.decisionId ?? null,
    )
    .first<TaskRow>();
  if (!row) throw new Error("Não foi possível criar a tarefa.");
  return taskFromRow(row);
}

export async function updateStrategicTaskStatus(
  db: D1Database,
  input: { clientId: number; taskId: number; status: TaskStatus },
): Promise<StrategicTask> {
  if (input.status !== "open" && input.status !== "completed")
    throw new Error("Status de tarefa inválido.");
  const row = await db
    .prepare(
      `UPDATE tasks
     SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END, updated_at = datetime('now')
     WHERE id = ? AND client_id = ?
     RETURNING ${TASK_COLS}`,
    )
    .bind(input.status, input.status, input.taskId, input.clientId)
    .first<TaskRow>();
  if (!row) throw new Error("Tarefa não encontrada.");
  return taskFromRow(row);
}

export async function createStrategicDecision(
  db: D1Database,
  input: CreateDecisionInput,
): Promise<StrategicDecision> {
  const title = cleanRequired(input.title, "Título da decisão");
  const rationale = cleanRequired(input.rationale, "Contexto da decisão");
  ensureRange(input.baselineStart, input.baselineEnd, "referência");
  ensureRange(input.evaluationStart, input.evaluationEnd, "acompanhamento");
  const baselineRows = await getInsights(db, input.clientId, {
    start: input.baselineStart,
    end: input.baselineEnd,
  });
  const baseline = snapshotMetrics(totals(baselineRows));
  const origin = input.origin ?? { type: "manual" as const };
  const row = await db
    .prepare(
      `INSERT INTO decisions (client_id, title, rationale, entity_type, entity_name, origin_type, origin_key, origin_title, baseline_start, baseline_end, baseline_metrics_json, evaluation_start, evaluation_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING ${DECISION_COLS}`,
    )
    .bind(
      input.clientId,
      title,
      rationale,
      cleanOptional(input.entityType) ?? "account",
      cleanOptional(input.entityName),
      origin.type,
      cleanOptional(origin.key),
      cleanOptional(origin.title),
      input.baselineStart,
      input.baselineEnd,
      JSON.stringify(baseline),
      input.evaluationStart,
      input.evaluationEnd,
    )
    .first<DecisionRow>();
  if (!row) throw new Error("Não foi possível registrar a decisão.");
  return { ...baseDecision(row), observedMetrics: null, comparison: [] };
}

export async function updateDecisionObservation(
  db: D1Database,
  input: {
    clientId: number;
    decisionId: number;
    resultNote: string | null;
    status: DecisionStatus;
  },
): Promise<StrategicDecision> {
  if (!["active", "reviewed", "archived"].includes(input.status))
    throw new Error("Status de decisão inválido.");
  const row = await db
    .prepare(
      `UPDATE decisions SET result_note = ?, status = ?, updated_at = datetime('now')
     WHERE id = ? AND client_id = ?
     RETURNING ${DECISION_COLS}`,
    )
    .bind(cleanOptional(input.resultNote), input.status, input.decisionId, input.clientId)
    .first<DecisionRow>();
  if (!row) throw new Error("Decisão não encontrada.");
  const decision = baseDecision(row);
  return { ...decision, observedMetrics: null, comparison: [] };
}

export async function getClientStrategicMemory(
  db: D1Database,
  clientId: number,
): Promise<StrategicMemory> {
  const [tasks, decisionResult] = await Promise.all([
    listStrategicTasks(db, clientId),
    db
      .prepare(
        `SELECT ${DECISION_COLS} FROM decisions WHERE client_id = ? ORDER BY created_at DESC LIMIT 50`,
      )
      .bind(clientId)
      .all<DecisionRow>(),
  ]);
  const decisions = await Promise.all(
    decisionResult.results.map(async (row) => {
      const decision = baseDecision(row);
      const rows = await getInsights(db, clientId, decision.evaluation);
      if (rows.length === 0) return { ...decision, observedMetrics: null, comparison: [] };
      const observedMetrics = snapshotMetrics(totals(rows));
      return {
        ...decision,
        observedMetrics,
        comparison: compareMetrics(decision.baseline.metrics, observedMetrics),
      };
    }),
  );
  return { tasks, decisions };
}
