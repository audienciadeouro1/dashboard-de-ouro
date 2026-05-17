// Store global simples em memória para passar dados entre rotas
import type { ParsedDataset, ReportConfig } from "./csv/types";

interface Store {
  dataset: ParsedDataset | null;
  config: ReportConfig | null;
}

let store: Store = { dataset: null, config: null };
const listeners = new Set<() => void>();

export function setData(dataset: ParsedDataset, config: ReportConfig) {
  store = { dataset, config };
  listeners.forEach((l) => l());
}

export function setConfig(config: Partial<ReportConfig>) {
  if (store.config) {
    store = {
      ...store,
      config: { ...store.config, ...config },
    };
    listeners.forEach((l) => l());
  }
}

export function clearData() {
  store = { dataset: null, config: null };
  listeners.forEach((l) => l());
}

export function getData(): Store {
  return store;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
