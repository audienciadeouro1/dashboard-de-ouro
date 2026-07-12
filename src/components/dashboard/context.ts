import { createContext, useContext } from "react";
import type { ParsedDataset, ReportConfig } from "@/lib/csv/types";

interface DashboardContextType {
  dataset: ParsedDataset;
  config: ReportConfig;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard deve ser usado dentro de um DashboardProvider");
  return ctx;
}
