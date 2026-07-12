-- Fase 3: metas por cliente e registros gerados pelo motor determinístico.
CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  target REAL,
  limit_value REAL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, metric)
);

CREATE TABLE diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  fact TEXT NOT NULL,
  evidence TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, rule_key, period_start, period_end)
);

CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  threshold REAL NOT NULL DEFAULT 0,
  period_start TEXT,
  period_end TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, rule_key, period_start, period_end)
);

CREATE INDEX idx_goals_client ON goals (client_id, active);
CREATE INDEX idx_diagnostics_client ON diagnostics (client_id, created_at);
CREATE INDEX idx_alerts_client ON alerts (client_id, status, created_at);
