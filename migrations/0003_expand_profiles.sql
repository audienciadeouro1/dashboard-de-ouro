-- Remove o check constraint limitante da tabela clients recriando-a sem o CHECK
PRAGMA foreign_keys=OFF;

CREATE TABLE clients_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  color TEXT,
  meta_ad_account_id TEXT,
  dashboard_profile TEXT NOT NULL,
  contract_start TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO clients_new (
  id, name, slug, logo_url, color, meta_ad_account_id,
  dashboard_profile, contract_start, last_synced_at, created_at
)
SELECT 
  id, name, slug, logo_url, color, meta_ad_account_id,
  CASE dashboard_profile 
    WHEN 'pixel_sales' THEN 'sales'
    WHEN 'whatsapp_external' THEN 'maria-maria' -- mapeia os seeds antigos se necessário, ou mantém compatibilidade
    ELSE dashboard_profile 
  END,
  contract_start, last_synced_at, created_at
FROM clients;

DROP TABLE clients;
ALTER TABLE clients_new RENAME TO clients;

PRAGMA foreign_keys=ON;
