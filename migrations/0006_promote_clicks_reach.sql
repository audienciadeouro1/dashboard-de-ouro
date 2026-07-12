-- Promove cliques e alcance a colunas próprias (antes só dentro de row_json),
-- permitindo consultas e agregações em SQL. Backfill a partir do JSON salvo.
ALTER TABLE ad_daily_insights ADD COLUMN clicks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ad_daily_insights ADD COLUMN reach INTEGER NOT NULL DEFAULT 0;

UPDATE ad_daily_insights SET
  clicks = COALESCE(CAST(json_extract(row_json, '$.clicks') AS INTEGER), 0),
  reach = COALESCE(CAST(json_extract(row_json, '$.reach') AS INTEGER), 0);
