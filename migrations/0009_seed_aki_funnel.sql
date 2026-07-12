-- Fase 2B: funil de pixel (e-commerce) do Aki Sushi.
-- Etapas do funil vêm de eventos de pixel no CSV do Meta (colunas cruas em AdRow.rawData);
-- faturamento = valor de conversão da compra (Totals.conversionValue). Sem CSV comercial.
-- Idempotente: só insere se ainda não houver config para o cliente.
INSERT INTO funnel_configs (client_id, config_json)
SELECT c.id, json('{
  "metaStages": [
    { "key": "impressions", "label": "Impressões" },
    { "key": "viewContent", "label": "Visualizações de conteúdo", "column": "Visualizações do conteúdo no site" },
    { "key": "addToCart", "label": "Adições ao carrinho", "column": "Adições ao carrinho" },
    { "key": "initiateCheckout", "label": "Finalizações iniciadas", "column": "Finalizações da compra iniciadas no site" },
    { "key": "purchases", "label": "Compras" }
  ],
  "metaRevenueKey": "conversionValue"
}')
FROM clients c
WHERE c.slug = 'aki-sushi'
  AND NOT EXISTS (SELECT 1 FROM funnel_configs f WHERE f.client_id = c.id);
