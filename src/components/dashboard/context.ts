import { createContext, useContext } from "react";
import type { ParsedDataset, ReportConfig } from "@/lib/csv/types";
import type { CanonicalKey } from "@/lib/csv/normalize";

interface DashboardContextType {
  dataset: ParsedDataset;
  config: ReportConfig;
  /**
   * Persiste as métricas extras do dashboard. Presente nos dashboards de cliente
   * (grava no banco). Ausente na análise avulsa, que usa o store em memória.
   */
  onCustomKpisChange?: (kpis: CanonicalKey[]) => void;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard deve ser usado dentro de um DashboardProvider");
  return ctx;
}
