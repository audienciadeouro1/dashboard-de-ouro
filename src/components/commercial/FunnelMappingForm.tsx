import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import type { FunnelConfig } from "@/lib/csv/types";

type Role = "ignore" | "period" | "revenue" | "ticket" | "stage";

interface ColumnAssignment {
  role: Role;
  label: string; // rótulo da etapa (usado quando role === "stage")
}

interface FunnelMappingFormProps {
  headers: string[];
  initial?: FunnelConfig | null;
  onSave: (config: FunnelConfig) => void;
  saving?: boolean;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ignore", label: "Ignorar" },
  { value: "period", label: "Período (semana/mês)" },
  { value: "stage", label: "Etapa do funil" },
  { value: "revenue", label: "Faturamento (R$)" },
  { value: "ticket", label: "Ticket médio (R$)" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deriva a atribuição inicial de cada coluna a partir de uma config já salva. */
function assignmentsFromConfig(headers: string[], config: FunnelConfig | null | undefined) {
  const map = new Map<string, ColumnAssignment>();
  for (const h of headers) map.set(h, { role: "ignore", label: h });
  if (!config?.commercial) return map;
  const c = config.commercial;
  if (map.has(c.periodColumn)) map.set(c.periodColumn, { role: "period", label: c.periodColumn });
  if (map.has(c.revenueColumn)) map.set(c.revenueColumn, { role: "revenue", label: c.revenueColumn });
  if (c.ticketColumn && map.has(c.ticketColumn))
    map.set(c.ticketColumn, { role: "ticket", label: c.ticketColumn });
  for (const s of c.stages) {
    if (map.has(s.column)) map.set(s.column, { role: "stage", label: s.label });
  }
  return map;
}

export function FunnelMappingForm({ headers, initial, onSave, saving }: FunnelMappingFormProps) {
  const [assignments, setAssignments] = useState<Map<string, ColumnAssignment>>(() =>
    assignmentsFromConfig(headers, initial),
  );
  const [error, setError] = useState<string | null>(null);

  const setRole = (header: string, role: Role) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      const cur = next.get(header) ?? { role: "ignore", label: header };
      next.set(header, { ...cur, role });
      return next;
    });
  };
  const setLabel = (header: string, label: string) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      const cur = next.get(header) ?? { role: "ignore", label: header };
      next.set(header, { ...cur, label });
      return next;
    });
  };

  const build = useMemo(
    () => (): FunnelConfig | string => {
      let periodColumn = "";
      let revenueColumn = "";
      let ticketColumn: string | undefined;
      const stages: FunnelConfig["commercial"]["stages"] = [];
      // Mantém a ordem das colunas do CSV
      for (const h of headers) {
        const a = assignments.get(h);
        if (!a) continue;
        if (a.role === "period") periodColumn = h;
        else if (a.role === "revenue") revenueColumn = h;
        else if (a.role === "ticket") ticketColumn = h;
        else if (a.role === "stage")
          stages.push({ key: slugify(a.label) || slugify(h), label: a.label.trim() || h, column: h });
      }
      if (!periodColumn) return "Escolha qual coluna é o Período.";
      if (!revenueColumn) return "Escolha qual coluna é o Faturamento.";
      if (stages.length === 0) return "Marque pelo menos uma coluna como Etapa do funil.";
      return {
        metaStages: initial?.metaStages ?? [
          { key: "impressions", label: "Impressões" },
          { key: "clicks", label: "Cliques" },
          { key: "conversations", label: "Conversas iniciadas" },
        ],
        commercial: { periodColumn, revenueColumn, ticketColumn, stages },
      };
    },
    [assignments, headers, initial],
  );

  const handleSubmit = () => {
    const result = build();
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setError(null);
    onSave(result);
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Mapear colunas do CSV comercial
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Diga o que é cada coluna. O sistema lembra desse mapeamento nas próximas importações.
        </p>
      </div>

      <div className="space-y-3">
        {headers.map((h) => {
          const a = assignments.get(h);
          return (
            <div key={h} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="sm:w-1/3 text-sm font-medium text-foreground truncate" title={h}>
                {h}
              </div>
              <select
                value={a?.role ?? "ignore"}
                onChange={(e) => setRole(h, e.target.value as Role)}
                className="sm:w-1/3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {a?.role === "stage" && (
                <input
                  value={a.label}
                  onChange={(e) => setLabel(h, e.target.value)}
                  placeholder="Nome da etapa"
                  className="sm:w-1/3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <Button onClick={handleSubmit} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar mapeamento e importar"}
      </Button>
      <Label className="block text-xs text-muted-foreground text-center">
        As etapas seguem a ordem das colunas no CSV.
      </Label>
    </div>
  );
}
