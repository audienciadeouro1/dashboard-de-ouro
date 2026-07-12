-- Fase 2B: métricas extras fixadas no dashboard de cada cliente.
-- Guarda um array JSON de chaves de métrica (CanonicalKey) escolhidas pelo gestor.
ALTER TABLE clients ADD COLUMN dashboard_kpis TEXT NOT NULL DEFAULT '[]';
