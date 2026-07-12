import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchDataQuality } from "@/lib/api";
import type { QualityReport } from "@/lib/server/quality";
import { GOLD, WARNING, DANGER } from "./theme";

const LEVEL_UI = {
  ok: { color: GOLD, Icon: ShieldCheck, label: "Dados OK" },
  atencao: { color: WARNING, Icon: ShieldAlert, label: "Atenção nos dados" },
  problema: { color: DANGER, Icon: ShieldX, label: "Problema nos dados" },
} as const;

/** Selo de qualidade dos dados do período — clique abre os detalhes explicáveis. */
export function QualityBadge({
  slug,
  start,
  end,
}: {
  slug: string;
  start?: string;
  end?: string;
}) {
  const [report, setReport] = useState<QualityReport | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDataQuality({ data: { slug, start, end } })
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch(() => {
        if (alive) setReport(null);
      });
    return () => {
      alive = false;
    };
  }, [slug, start, end]);

  if (!report) return null;
  const { color, Icon, label } = LEVEL_UI[report.level];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[oklch(0.83_0.16_88_/_0.08)] no-print"
          style={{ borderColor: color, color }}
          title="Qualidade dos dados do período — clique para detalhes"
        >
          <Icon className="w-3.5 h-3.5" />
          {label} · {report.score}%
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
        <DialogHeader>
          <DialogTitle style={{ color }}>Qualidade dos dados — {report.score}%</DialogTitle>
        </DialogHeader>
        {report.period && (
          <p className="text-xs text-muted-foreground">
            Período avaliado: {report.period.start} a {report.period.end}
          </p>
        )}
        {report.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum problema encontrado: todos os dias do período têm dados e as colunas importantes
            estão presentes.
          </p>
        ) : (
          <ul className="space-y-3">
            {report.issues.map((issue, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: issue.severity === "problema" ? DANGER : WARNING }}
                />
                <span className="text-foreground">
                  {issue.message}{" "}
                  <span className="text-muted-foreground">(−{issue.penalty} pontos)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
