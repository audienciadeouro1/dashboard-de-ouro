import { useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  CircleCheck,
  NotebookPen,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createClientDecision,
  createClientTask,
  saveClientDecisionObservation,
  saveClientGoal,
  updateClientTaskStatus,
} from "@/lib/api";
import { addDays } from "@/lib/metrics/compare";
import {
  DECISION_METRIC_LABELS,
  type StrategicMemory,
  type StrategicOriginType,
  type StrategicTask,
  type TaskPriority,
} from "@/lib/metrics/strategic-memory";
import type { Alert, Diagnostic, Goal, GoalMetric } from "@/lib/metrics/diagnostics";

const METRICS: { key: GoalMetric; label: string; suffix: string }[] = [
  { key: "cpa", label: "CPA", suffix: "BRL" },
  { key: "roas", label: "ROAS", suffix: "x" },
  { key: "ctr", label: "CTR", suffix: "%" },
  { key: "costPerConversation", label: "Custo por conversa", suffix: "BRL" },
  { key: "frequency", label: "Frequência", suffix: "x" },
];

type ActionOrigin = {
  type: Exclude<StrategicOriginType, "decision">;
  key?: string | null;
  title?: string | null;
  detail?: string | null;
  baselineStart?: string | null;
  baselineEnd?: string | null;
};

type TaskDraft = {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  origin: ActionOrigin;
};

type DecisionDraft = {
  title: string;
  rationale: string;
  baselineStart: string;
  baselineEnd: string;
  evaluationStart: string;
  evaluationEnd: string;
  origin: ActionOrigin;
};

function severityClass(severity: string) {
  return severity === "critico"
    ? "border-red-500/40 bg-red-500/10 text-red-200"
    : severity === "atencao"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
      : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";
}

function formatValue(metric: keyof typeof DECISION_METRIC_LABELS, value: number): string {
  if (["spend", "conversionValue", "cpa", "costPerConversation"].includes(metric)) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  if (metric === "ctr") return `${value.toFixed(2)}%`;
  if (metric === "roas") return `${value.toFixed(2)}x`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatDifference(metric: keyof typeof DECISION_METRIC_LABELS, value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatValue(metric, value)}`;
}

function GoalEditor({ clientId, initial }: { clientId: number; initial: Goal[] }) {
  const [goals, setGoals] = useState<Record<GoalMetric, Goal>>(
    () =>
      Object.fromEntries(
        METRICS.map(({ key }) => [
          key,
          initial.find((goal) => goal.metric === key) ?? {
            clientId,
            metric: key,
            target: null,
            limitValue: null,
            active: true,
          },
        ]),
      ) as Record<GoalMetric, Goal>,
  );
  const [saving, setSaving] = useState<GoalMetric | null>(null);

  const update = (metric: GoalMetric, patch: Partial<Goal>) =>
    setGoals((current) => ({ ...current, [metric]: { ...current[metric], ...patch } }));
  const save = async (metric: GoalMetric) => {
    setSaving(metric);
    try {
      await saveClientGoal({ data: goals[metric] });
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="glass-card rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Metas e limites deste cliente</h3>
        <p className="text-xs text-muted-foreground mt-1">
          O motor só dispara regras para métricas configuradas aqui.
        </p>
      </div>
      <div className="grid gap-3">
        {METRICS.map(({ key, label, suffix }) => {
          const goal = goals[key];
          return (
            <div
              key={key}
              className="grid grid-cols-[minmax(130px,1fr)_minmax(100px,140px)_minmax(100px,140px)_auto] items-center gap-2 border-b border-white/10 pb-3 last:border-0"
            >
              <label className="text-sm font-medium">
                {label} <span className="text-xs text-muted-foreground">({suffix})</span>
              </label>
              <Input
                aria-label={`${label} meta`}
                type="number"
                step="any"
                placeholder="Meta"
                value={goal.target ?? ""}
                onChange={(event) =>
                  update(key, {
                    target: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
                className="h-8"
              />
              <Input
                aria-label={`${label} limite`}
                type="number"
                step="any"
                placeholder="Limite"
                value={goal.limitValue ?? ""}
                onChange={(event) =>
                  update(key, {
                    limitValue: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
                className="h-8"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void save(key)}
                disabled={saving === key}
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salvar</span>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SourceActions({
  origin,
  onTask,
  onDecision,
}: {
  origin: ActionOrigin;
  onTask: (origin: ActionOrigin) => void;
  onDecision: (origin: ActionOrigin) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button size="sm" variant="outline" onClick={() => onTask(origin)}>
        <ClipboardList className="w-3.5 h-3.5" /> Criar tarefa
      </Button>
      <Button size="sm" variant="outline" onClick={() => onDecision(origin)}>
        <NotebookPen className="w-3.5 h-3.5" /> Registrar decisão
      </Button>
    </div>
  );
}

function StrategicMemorySection({
  clientId,
  initial,
  diagnostics,
  alerts,
}: {
  clientId: number;
  initial: StrategicMemory;
  diagnostics: Diagnostic[];
  alerts: Alert[];
}) {
  const [tasks, setTasks] = useState(initial.tasks);
  const [decisions, setDecisions] = useState(initial.decisions);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    origin: { type: "manual" },
  });
  const [decisionDraft, setDecisionDraft] = useState<DecisionDraft>({
    title: "",
    rationale: "",
    baselineStart: "",
    baselineEnd: "",
    evaluationStart: "",
    evaluationEnd: "",
    origin: { type: "manual" },
  });

  const openTask = (origin: ActionOrigin = { type: "manual" }) => {
    setError(null);
    setTaskDraft({
      title: origin.title ? `Ação: ${origin.title}` : "",
      description: origin.detail ?? "",
      priority: origin.type === "alert" ? "high" : "medium",
      dueDate: "",
      origin,
    });
    setTaskDialogOpen(true);
  };

  const openDecision = (origin: ActionOrigin = { type: "manual" }) => {
    const nextStart = origin.baselineEnd ? addDays(origin.baselineEnd, 1) : "";
    setError(null);
    setDecisionDraft({
      title: origin.title ? `Decisão: ${origin.title}` : "",
      rationale: origin.detail ?? "",
      baselineStart: origin.baselineStart ?? "",
      baselineEnd: origin.baselineEnd ?? "",
      evaluationStart: nextStart,
      evaluationEnd: nextStart ? addDays(nextStart, 6) : "",
      origin,
    });
    setDecisionDialogOpen(true);
  };

  const saveTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const task = await createClientTask({
        data: {
          clientId,
          title: taskDraft.title,
          description: taskDraft.description || null,
          priority: taskDraft.priority,
          dueDate: taskDraft.dueDate || null,
          origin: taskDraft.origin,
        },
      });
      setTasks((current) => [task, ...current]);
      setTaskDialogOpen(false);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const saveDecision = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const decision = await createClientDecision({
        data: {
          clientId,
          title: decisionDraft.title,
          rationale: decisionDraft.rationale,
          origin: decisionDraft.origin,
          baselineStart: decisionDraft.baselineStart,
          baselineEnd: decisionDraft.baselineEnd,
          evaluationStart: decisionDraft.evaluationStart,
          evaluationEnd: decisionDraft.evaluationEnd,
        },
      });
      setDecisions((current) => [decision, ...current]);
      setDecisionDialogOpen(false);
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleTask = async (task: StrategicTask) => {
    setSaving(true);
    try {
      const updated = await updateClientTaskStatus({
        data: { clientId, taskId: task.id, status: task.status === "open" ? "completed" : "open" },
      });
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } finally {
      setSaving(false);
    }
  };

  const saveObservation = async (decisionId: number) => {
    setSaving(true);
    try {
      const updated = await saveClientDecisionObservation({
        data: {
          clientId,
          decisionId,
          resultNote: noteDrafts[decisionId] ?? null,
          status: "reviewed",
        },
      });
      setDecisions((current) =>
        current.map((decision) =>
          decision.id === updated.id
            ? { ...decision, resultNote: updated.resultNote, status: updated.status }
            : decision,
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold">Memória estratégica</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Registre o que foi feito, acompanhe o resultado e preserve o aprendizado do cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openTask()}>
            <Plus className="w-3.5 h-3.5" /> Nova tarefa
          </Button>
          <Button size="sm" onClick={() => openDecision()}>
            <NotebookPen className="w-3.5 h-3.5" /> Registrar decisão
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Tarefas</h4>
            <span className="text-xs text-muted-foreground">
              {tasks.filter((task) => task.status === "open").length} em aberto
            </span>
          </div>
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-muted-foreground">
              Nenhuma tarefa registrada ainda.
            </p>
          ) : (
            tasks.map((task) => (
              <article key={task.id} className="rounded-lg border border-white/10 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5
                      className={
                        task.status === "completed"
                          ? "text-sm line-through text-muted-foreground"
                          : "text-sm font-medium"
                      }
                    >
                      {task.title}
                    </h5>
                    {task.originTitle && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Origem: {task.originTitle}
                      </p>
                    )}
                  </div>
                  <span className="rounded border border-white/15 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {task.priority === "high"
                      ? "alta"
                      : task.priority === "low"
                        ? "baixa"
                        : "média"}
                  </span>
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                )}
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{task.dueDate ? `Prazo: ${task.dueDate}` : "Sem prazo definido"}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void toggleTask(task)}
                  >
                    {task.status === "completed" ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <CircleCheck className="w-3.5 h-3.5" />
                    )}
                    {task.status === "completed" ? "Reabrir" : "Concluir"}
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Decisões e acompanhamento</h4>
            <span className="text-xs text-muted-foreground">{decisions.length} registrada(s)</span>
          </div>
          {decisions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-muted-foreground">
              Registre uma decisão para criar uma referência de acompanhamento.
            </p>
          ) : (
            decisions.map((decision) => (
              <article
                key={decision.id}
                className="rounded-lg border border-white/10 p-4 space-y-3"
              >
                <div>
                  <h5 className="text-sm font-medium">{decision.title}</h5>
                  <p className="mt-1 text-xs text-muted-foreground">{decision.rationale}</p>
                  {decision.originTitle && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Origem: {decision.originTitle}
                    </p>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>
                    Referência: {decision.baseline.start} a {decision.baseline.end}
                  </p>
                  <p>
                    Acompanhar: {decision.evaluation.start} a {decision.evaluation.end}
                  </p>
                </div>
                {decision.observedMetrics ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Variação observada no período de acompanhamento
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {decision.comparison.map((item) => (
                        <div key={item.metric} className="rounded border border-white/10 p-2">
                          <p className="text-muted-foreground">
                            {DECISION_METRIC_LABELS[item.metric]}
                          </p>
                          <p className="mt-1 text-foreground">
                            {formatValue(item.metric, item.observed)}
                          </p>
                          <p className="text-muted-foreground">
                            vs. {formatValue(item.metric, item.baseline)} ·{" "}
                            {formatDifference(item.metric, item.difference)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded border border-dashed border-white/15 p-3 text-xs text-muted-foreground">
                    Ainda não há dados no período de acompanhamento.
                  </p>
                )}
                <div className="space-y-2">
                  <Textarea
                    aria-label={`Observação da decisão ${decision.title}`}
                    placeholder="Registre o que foi observado, sem atribuir automaticamente a mudança a esta decisão."
                    value={noteDrafts[decision.id] ?? decision.resultNote ?? ""}
                    onChange={(event) =>
                      setNoteDrafts((current) => ({
                        ...current,
                        [decision.id]: event.target.value,
                      }))
                    }
                    className="min-h-18 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void saveObservation(decision.id)}
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar observação
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A comparação mostra variações observadas; outros fatores também podem ter
                  influenciado o resultado.
                </p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-white/10 pt-5 space-y-4">
        <div>
          <h4 className="text-sm font-semibold">Transformar diagnóstico em ação</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            As tarefas e decisões abaixo já ficam vinculadas ao alerta ou diagnóstico que as
            motivou.
          </p>
        </div>
        {alerts.length > 0 ? (
          <div className="grid gap-3">
            {alerts.map((alert) => {
              const origin: ActionOrigin = {
                type: "alert",
                key: alert.ruleKey,
                title: alert.title,
                baselineStart: alert.period.start,
                baselineEnd: alert.period.end,
              };
              return (
                <div
                  key={alert.ruleKey}
                  className={`rounded-lg border p-4 ${severityClass(alert.severity)}`}
                >
                  <div className="font-semibold text-sm">{alert.title}</div>
                  <div className="text-xs mt-1 opacity-80">
                    Valor observado: {alert.value.toFixed(2)} · Referência:{" "}
                    {alert.threshold.toFixed(2)}
                  </div>
                  <SourceActions origin={origin} onTask={openTask} onDecision={openDecision} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 flex items-center gap-3 text-sm text-emerald-200">
            <CheckCircle2 className="w-5 h-5" /> Nenhum alerta foi disparado para o período.
          </div>
        )}
        {diagnostics.length > 0 ? (
          <div className="grid gap-4">
            {diagnostics.map((diagnostic) => {
              const origin: ActionOrigin = {
                type: "diagnostic",
                key: diagnostic.ruleKey,
                title: diagnostic.title,
                detail: diagnostic.recommendation,
                baselineStart: diagnostic.period.start,
                baselineEnd: diagnostic.period.end,
              };
              return (
                <article
                  key={diagnostic.ruleKey}
                  className="rounded-xl border border-white/10 p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{diagnostic.title}</h3>
                      <span
                        className={`inline-flex mt-2 rounded-md border px-2 py-0.5 text-[11px] ${severityClass(diagnostic.severity)}`}
                      >
                        {diagnostic.severity}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Confiança {diagnostic.confidence}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <strong className="text-foreground">Fato</strong>
                      <p className="text-muted-foreground mt-1">{diagnostic.fact}</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Evidência</strong>
                      <p className="text-muted-foreground mt-1">{diagnostic.evidence}</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Hipótese</strong>
                      <p className="text-muted-foreground mt-1">{diagnostic.hypothesis}</p>
                    </div>
                    <div>
                      <strong className="text-foreground">Recomendação</strong>
                      <p className="text-muted-foreground mt-1">{diagnostic.recommendation}</p>
                    </div>
                  </div>
                  <SourceActions origin={origin} onTask={openTask} onDecision={openDecision} />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-muted-foreground">
            Ainda não há evidências suficientes para gerar um diagnóstico no período.
          </p>
        )}
      </div>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar tarefa</DialogTitle>
            <DialogDescription>
              Uma ação prática vinculada ao cliente e, quando houver, ao diagnóstico que a originou.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void saveTask(event)}>
            <Input
              aria-label="Título da tarefa"
              placeholder="Ex.: Revisar criativo da campanha"
              value={taskDraft.title}
              onChange={(event) =>
                setTaskDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
            <Textarea
              aria-label="Descrição da tarefa"
              placeholder="Contexto ou próximo passo"
              value={taskDraft.description}
              onChange={(event) =>
                setTaskDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Prioridade
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={taskDraft.priority}
                  onChange={(event) =>
                    setTaskDraft((current) => ({
                      ...current,
                      priority: event.target.value as TaskPriority,
                    }))
                  }
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </label>
              <label className="text-sm">
                Prazo
                <Input
                  className="mt-1"
                  type="date"
                  value={taskDraft.dueDate}
                  onChange={(event) =>
                    setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                Salvar tarefa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar decisão</DialogTitle>
            <DialogDescription>
              O sistema guarda as métricas de referência agora e compara o período posterior como
              observação, não como prova de causa.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void saveDecision(event)}>
            <Input
              aria-label="Título da decisão"
              placeholder="Ex.: Testar novo criativo"
              value={decisionDraft.title}
              onChange={(event) =>
                setDecisionDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
            <Textarea
              aria-label="Contexto da decisão"
              placeholder="O que será feito e por quê?"
              value={decisionDraft.rationale}
              onChange={(event) =>
                setDecisionDraft((current) => ({ ...current, rationale: event.target.value }))
              }
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm">
                Referência — início
                <Input
                  className="mt-1"
                  required
                  type="date"
                  value={decisionDraft.baselineStart}
                  onChange={(event) =>
                    setDecisionDraft((current) => ({
                      ...current,
                      baselineStart: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                Referência — fim
                <Input
                  className="mt-1"
                  required
                  type="date"
                  value={decisionDraft.baselineEnd}
                  onChange={(event) =>
                    setDecisionDraft((current) => ({ ...current, baselineEnd: event.target.value }))
                  }
                />
              </label>
              <label className="text-sm">
                Acompanhar — início
                <Input
                  className="mt-1"
                  required
                  type="date"
                  value={decisionDraft.evaluationStart}
                  onChange={(event) =>
                    setDecisionDraft((current) => ({
                      ...current,
                      evaluationStart: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                Acompanhar — fim
                <Input
                  className="mt-1"
                  required
                  type="date"
                  value={decisionDraft.evaluationEnd}
                  onChange={(event) =>
                    setDecisionDraft((current) => ({
                      ...current,
                      evaluationEnd: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                Registrar decisão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function ClientDiagnosticsTab({
  clientId,
  goals,
  diagnostics,
  alerts,
  strategicMemory,
}: {
  clientId: number;
  goals: Goal[];
  diagnostics: Diagnostic[];
  alerts: Alert[];
  strategicMemory: StrategicMemory;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold">Diagnóstico</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Regras determinísticas aplicadas ao período selecionado.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="text-lg font-semibold text-foreground">{alerts.length}</div>alerta(s)
          ativo(s)
        </div>
      </div>

      <StrategicMemorySection
        clientId={clientId}
        initial={strategicMemory}
        diagnostics={diagnostics}
        alerts={alerts}
      />

      <GoalEditor clientId={clientId} initial={goals} />
    </div>
  );
}
