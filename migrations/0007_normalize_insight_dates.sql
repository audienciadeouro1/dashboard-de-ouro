-- Normaliza a coluna date de ad_daily_insights para YYYY-MM-DD.
-- CSVs da Meta em PT-BR gravavam DD/MM/YYYY, o que quebrava o filtro de período
-- (comparação de texto), o MIN/MAX do intervalo e a ordenação por data.
-- O row_json não é alterado: a tela continua exibindo o formato original do CSV.
-- OR REPLACE cobre o caso raro de o mesmo dia existir nos dois formatos (mantém o convertido).
UPDATE OR REPLACE ad_daily_insights
SET date = substr(date, 7, 4) || '-' || substr(date, 4, 2) || '-' || substr(date, 1, 2)
WHERE date LIKE '__/__/____';
