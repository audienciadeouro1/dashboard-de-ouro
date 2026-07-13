-- Fase 4: memória estratégica. Mantém ações e decisões agregadas por cliente,
-- sem dados individuais de leads ou funcionalidades de CRM.
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  origin_type TEXT NOT NULL DEFAULT 'manual' CHECK (origin_type IN ('manual', 'diagnostic', 'alert', 'decision')),
  origin_key TEXT,
  origin_title TEXT,
  decision_id INTEGER REFERENCES decisions(id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'account',
  entity_name TEXT,
  origin_type TEXT NOT NULL DEFAULT 'manual' CHECK (origin_type IN ('manual', 'diagnostic', 'alert')),
  origin_key TEXT,
  origin_title TEXT,
  baseline_start TEXT NOT NULL,
  baseline_end TEXT NOT NULL,
  baseline_metrics_json TEXT NOT NULL,
  evaluation_start TEXT NOT NULL,
  evaluation_end TEXT NOT NULL,
  result_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reviewed', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tasks_client_status ON tasks (client_id, status, created_at DESC);
CREATE INDEX idx_decisions_client_status ON decisions (client_id, status, created_at DESC);
