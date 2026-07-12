-- Clientes fixos do gestor
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  color TEXT,
  meta_ad_account_id TEXT,
  dashboard_profile TEXT NOT NULL CHECK (dashboard_profile IN ('pixel_sales', 'whatsapp_external')),
  contract_start TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Matéria-prima: uma linha = cliente + dia + anúncio
CREATE TABLE ad_daily_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  ad_key TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  ad_set_name TEXT NOT NULL DEFAULT '',
  ad_name TEXT NOT NULL DEFAULT '',
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversations INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  conversion_value REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('csv', 'meta_api')),
  row_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, date, ad_key)
);
CREATE INDEX idx_insights_client_date ON ad_daily_insights (client_id, date);

-- Dados externos semanais (caso Maria Maria: planilha do salão)
CREATE TABLE external_weekly_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  contatos_whatsapp INTEGER NOT NULL DEFAULT 0,
  agendamentos INTEGER NOT NULL DEFAULT 0,
  agendamentos_com_servico INTEGER NOT NULL DEFAULT 0,
  faturamento REAL NOT NULL DEFAULT 0,
  ticket_medio REAL NOT NULL DEFAULT 0,
  UNIQUE (client_id, start_date)
);

-- Rastreamento de leads (tela nova na Fase 1b; schema pronto desde já)
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('qualificado', 'reuniao', 'proposta', 'fechado', 'perdido')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
