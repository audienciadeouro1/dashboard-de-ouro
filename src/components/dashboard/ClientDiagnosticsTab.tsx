import { useState } from "react";
import { CheckCircle2, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveClientGoal } from "@/lib/api";
import type { Alert, Diagnostic, Goal, GoalMetric } from "@/lib/metrics/diagnostics";

const METRICS: { key: GoalMetric; label: string; suffix: string }[] = [
  { key: "cpa", label: "CPA", suffix: "BRL" },
  { key: "roas", label: "ROAS", suffix: "x" },
  { key: "ctr", label: "CTR", suffix: "%" },
  { key: "costPerConversation", label: "Custo por conversa", suffix: "BRL" },
  { key: "frequency", label: "Frequência", suffix: "x" },
];

function severityClass(severity: string) {
  return severity === "critico"
    ? "border-red-500/40 bg-red-500/10 text-red-200"
    : severity === "atencao"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
      : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
}

function GoalEditor({ clientId, initial }: { clientId: number; initial: Goal[] }) {
  const [goals, setGoals] = useState<Record<GoalMetric, Goal>>(() =>
    Object.fromEntries(METRICS.map(({ key }) => [key, initial.find((g) => g.metric === key) ?? { clientId, metric: key, target: null, limitValue: null, active: true }])) as Record<GoalMetric, Goal>,
  );
  const [saving, setSaving] = useState<GoalMetric | null>(null);

  const update = (metric: GoalMetric, patch: Partial<Goal>) => setGoals((current) => ({ ...current, [metric]: { ...current[metric], ...patch } }));
  const save = async (metric: GoalMetric) => {
    setSaving(metric);
    try { await saveClientGoal({ data: goals[metric] }); } finally { setSaving(null); }
  };

  return (
    <section className="glass-card rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Metas e limites deste cliente</h3>
        <p className="text-xs text-muted-foreground mt-1">O motor só dispara regras para métricas configuradas aqui.</p>
      </div>
      <div className="grid gap-3">
        {METRICS.map(({ key, label, suffix }) => {
          const goal = goals[key];
          return (
            <div key={key} className="grid grid-cols-[minmax(130px,1fr)_minmax(100px,140px)_minmax(100px,140px)_auto] items-center gap-2 border-b border-white/10 pb-3 last:border-0">
              <label className="text-sm font-medium">{label} <span className="text-xs text-muted-foreground">({suffix})</span></label>
              <Input aria-label={`${label} meta`} type="number" step="any" placeholder="Meta" value={goal.target ?? ""} onChange={(e) => update(key, { target: e.target.value === "" ? null : Number(e.target.value) })} className="h-8" />
              <Input aria-label={`${label} limite`} type="number" step="any" placeholder="Limite" value={goal.limitValue ?? ""} onChange={(e) => update(key, { limitValue: e.target.value === "" ? null : Number(e.target.value) })} className="h-8" />
              <Button size="sm" variant="outline" onClick={() => void save(key)} disabled={saving === key} title={`Salvar ${label}`}><Save className="w-3.5 h-3.5" /><span className="hidden sm:inline">Salvar</span></Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ClientDiagnosticsTab({ clientId, goals, diagnostics, alerts }: { clientId: number; goals: Goal[]; diagnostics: Diagnostic[]; alerts: Alert[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="font-display text-2xl font-semibold">Diagnóstico</h2><p className="text-sm text-muted-foreground mt-1">Regras determinísticas aplicadas ao período selecionado.</p></div>
        <div className="text-right text-xs text-muted-foreground"><div className="text-lg font-semibold text-foreground">{alerts.length}</div>alerta(s) ativo(s)</div>
      </div>

      {alerts.length > 0 ? <div className="grid gap-3">{alerts.map((alert) => <div key={alert.ruleKey} className={`rounded-lg border p-4 flex items-start gap-3 ${severityClass(alert.severity)}`}><ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" /><div><div className="font-semibold text-sm">{alert.title}</div><div className="text-xs mt-1 opacity-80">Valor observado: {alert.value.toFixed(2)} · Referência: {alert.threshold.toFixed(2)}</div></div></div>)}</div> : <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-emerald-200"><CheckCircle2 className="w-5 h-5" /> Nenhum alerta foi disparado para o período.</div>}

      {diagnostics.length > 0 ? <div className="grid gap-4">{diagnostics.map((diagnostic) => <article key={diagnostic.ruleKey} className="glass-card rounded-xl p-5 space-y-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{diagnostic.title}</h3><span className={`inline-flex mt-2 rounded-md border px-2 py-0.5 text-[11px] ${severityClass(diagnostic.severity)}`}>{diagnostic.severity}</span></div><span className="text-xs text-muted-foreground">Confiança {diagnostic.confidence}</span></div><div className="grid md:grid-cols-2 gap-3 text-sm"><div><strong className="text-foreground">Fato</strong><p className="text-muted-foreground mt-1">{diagnostic.fact}</p></div><div><strong className="text-foreground">Evidência</strong><p className="text-muted-foreground mt-1">{diagnostic.evidence}</p></div><div><strong className="text-foreground">Hipótese</strong><p className="text-muted-foreground mt-1">{diagnostic.hypothesis}</p></div><div><strong className="text-foreground">Recomendação</strong><p className="text-muted-foreground mt-1">{diagnostic.recommendation}</p></div></div></article>)}</div> : <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">Ainda não há evidências suficientes para gerar um diagnóstico no período.</div>}

      <GoalEditor clientId={clientId} initial={goals} />
    </div>
  );
}
