-- Fase 2A: dados comerciais genéricos + configuração de funil por cliente.

-- Definição do funil por cliente (etapas Meta + etapas comerciais + mapeamento).
CREATE TABLE funnel_configs (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dados comerciais importados (resumo por período), linha crua preservada.
CREATE TABLE commercial_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,          -- YYYY-MM-DD
  end_date TEXT NOT NULL,            -- YYYY-MM-DD
  label TEXT NOT NULL DEFAULT '',    -- texto original do período (ex: "16/04 a 18/04")
  row_json TEXT NOT NULL,            -- linha crua completa do CSV
  source TEXT NOT NULL DEFAULT 'csv',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, start_date)
);
CREATE INDEX idx_commercial_periods_client ON commercial_periods (client_id, start_date);
