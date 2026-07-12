import { AlertTriangle, Lightbulb, Sparkles, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AccountDiagnosis, DiagnosedCampaign } from "@/lib/csv/diagnostics";
import type { AnalysisMode } from "@/lib/csv/types";
import { SUCCESS, DANGER, WARNING } from "./theme";
import { DxList } from "./shared";

export function DiagnosisTab({
  dx,
  diagnosed,
}: {
  dx: AccountDiagnosis;
  diagnosed: DiagnosedCampaign[];
  mode: AnalysisMode;
}) {
  const ringColor = dx.score >= 65 ? SUCCESS : dx.score >= 45 ? WARNING : DANGER;
  const circumference = 2 * Math.PI * 56;
  const offset = circumference - (dx.score / 100) * circumference;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Score da conta
          </div>
          <div className="relative w-36 h-36">
            <svg className="transform -rotate-90 w-full h-full">
              <circle
                cx="72"
                cy="72"
                r="56"
                stroke="oklch(0.22 0 0)"
                strokeWidth="10"
                fill="none"
              />
              <circle
                cx="72"
                cy="72"
                r="56"
                stroke={ringColor}
                strokeWidth="10"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-4xl font-bold gold-text">{dx.score}</div>
              <div className="text-xs text-muted-foreground">de 100</div>
            </div>
          </div>
          <div className="mt-4 text-lg font-semibold" style={{ color: ringColor }}>
            {dx.scoreLabel}
          </div>
        </div>

        <div className="lg:col-span-2 glass-card rounded-xl p-6 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-[oklch(0.83_0.16_88)]" />
            <h3 className="font-display text-xl font-semibold">Diagnóstico geral</h3>
          </div>
          <p className="text-foreground/85 leading-relaxed">{dx.summary}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <DxList
          title="Pontos fortes"
          items={dx.strengths}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="success"
        />
        <DxList
          title="Pontos de atenção"
          items={dx.warnings}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="warning"
        />
        <DxList
          title="Oportunidades"
          items={dx.opportunities}
          icon={<Sparkles className="w-4 h-4" />}
          color="gold"
        />
      </div>

      <div className="glass-card rounded-xl p-6">
        <h3 className="font-display text-lg font-semibold mb-4">Recomendações por campanha</h3>
        <div className="space-y-3">
          {diagnosed.map((c) => (
            <div
              key={c.key}
              className="flex items-start justify-between gap-4 pb-3 border-b border-[oklch(0.83_0.16_88_/_0.08)] last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{c.key}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.reason}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
