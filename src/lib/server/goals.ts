import type { D1Database } from "@cloudflare/workers-types";
import type { Goal, GoalMetric } from "../metrics/diagnostics";

interface GoalRow {
  id: number;
  client_id: number;
  metric: GoalMetric;
  target: number | null;
  limit_value: number | null;
  active: number;
}

function toGoal(row: GoalRow): Goal {
  return { id: row.id, clientId: row.client_id, metric: row.metric, target: row.target, limitValue: row.limit_value, active: row.active === 1 };
}

export async function listGoals(db: D1Database, clientId: number): Promise<Goal[]> {
  const { results } = await db.prepare("SELECT id, client_id, metric, target, limit_value, active FROM goals WHERE client_id = ? ORDER BY metric").bind(clientId).all<GoalRow>();
  return results.map(toGoal);
}

export async function saveGoal(db: D1Database, goal: Omit<Goal, "id">): Promise<Goal> {
  await db.prepare(`INSERT INTO goals (client_id, metric, target, limit_value, active)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(client_id, metric) DO UPDATE SET target=excluded.target, limit_value=excluded.limit_value, active=excluded.active, updated_at=datetime('now')`)
    .bind(goal.clientId, goal.metric, goal.target, goal.limitValue, goal.active ? 1 : 0).run();
  const row = await db.prepare("SELECT id, client_id, metric, target, limit_value, active FROM goals WHERE client_id = ? AND metric = ?").bind(goal.clientId, goal.metric).first<GoalRow>();
  if (!row) throw new Error("Meta não encontrada após salvar.");
  return toGoal(row);
}
