-- Histórico de importações: toda ingestão de dados fica registrada
-- (qual arquivo, de qual cliente, qual período e quantas linhas).
CREATE TABLE csv_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('meta_csv', 'external_weekly')),
  file_name TEXT NOT NULL DEFAULT '',
  period_start TEXT,
  period_end TEXT,
  rows_saved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_csv_imports_client ON csv_imports (client_id, created_at);
