# Fase 2A — Fundação comercial genérica + importação com mapeamento

**Data:** 2026-07-12
**Branch:** `v1.4-nova-fase-sistema`
**Contexto:** primeira parte da Fase 2 (funil e comparações). Decompõe a fase em 2A (esta, fundação de dados comerciais), 2B (funil real + ROAS/CAC) e 2C (comparador de períodos). Só 2A é escopo deste spec.

## Objetivo

Permitir que **qualquer cliente** importe seus dados comerciais (hoje um CSV gerado a partir do PDF da cliente por skill externa) com **etapas de funil configuráveis por cliente**, aposentando o modelo "chumbado" da Maria Maria sem perder os dados existentes.

Regra nº 1 (inegociável): **não quebrar** a exibição atual da Maria Maria nem qualquer funcionalidade existente. Nada muda de resultado para dados já em produção.

## Realidade dos dados (exemplos reais)

CSV comercial da Maria Maria (resumo por semana, PT-BR, números com vírgula decimal):

```
Semana,Contatos Whatsapp,Agendamentos,Agendamentos com serviço,Taxa de Conversão Whatsapp,Taxa de Conversão Loja,TM,Total
16/04 a 18/04,28,2,2,"7,14%","100,00%","142,45","284,9"
19/04 a 25/04,138,15,5,"10,87%","33,33%",260,1300
```

- Coluna de período = **intervalo `DD/MM a DD/MM`** (sem ano).
- Colunas de etapa (contagem): `Contatos Whatsapp`, `Agendamentos`, `Agendamentos com serviço`.
- Colunas de valor: `TM` (ticket médio, R$), `Total` (faturamento, R$).
- Colunas derivadas (taxas) são **ignoradas** na importação — o sistema recalcula taxas deterministicamente.

CSV Meta Ads: diário por anúncio; resultado da Maria Maria = "Conversas por mensagem iniciadas". Já ingerido em `ad_daily_insights`.

## Modelo conceitual

Cada cliente tem um **funil = lista ordenada de etapas**. Cada etapa tem origem:

- `meta` — número vem de `ad_daily_insights` (ex.: Impressões, Cliques, Conversas iniciadas). Métrica identificada por chave já existente no motor de métricas.
- `commercial` — número vem de uma coluna do CSV comercial (ex.: Contatos WhatsApp, Agendamentos, Vendas).

Além das etapas, o funil comercial tem dois papéis de valor: **faturamento** (obrigatório para ROAS) e **ticket médio** (opcional).

Funil-alvo Maria Maria: Impressões → Cliques → Conversas iniciadas (meta) → Contatos WhatsApp → Agendamentos → Vendas (commercial) + Faturamento/Ticket.

**Limitação honesta e assumida:** dado comercial é agregado por período, não por venda. Não há atribuição venda→campanha. O funil mede o período inteiro. A diferença entre "conversas iniciadas" (Meta) e "contatos WhatsApp" (comercial) é esperada e vira insumo de diagnóstico na Fase 3.

## Modelo de dados (migração 0008)

Espelha o padrão de `ad_daily_insights` (linha crua em `row_json` + valores promovidos + upsert idempotente).

### `funnel_configs` — configuração por cliente
- `client_id` (UNIQUE, FK)
- `config_json` — definição completa do funil:
  ```json
  {
    "metaStages": [
      {"key": "impressions", "label": "Impressões"},
      {"key": "clicks", "label": "Cliques"},
      {"key": "conversations", "label": "Conversas iniciadas"}
    ],
    "commercial": {
      "periodColumn": "Semana",
      "revenueColumn": "Total",
      "ticketColumn": "TM",
      "stages": [
        {"key": "contatos", "label": "Contatos WhatsApp", "column": "Contatos Whatsapp"},
        {"key": "agendamentos", "label": "Agendamentos", "column": "Agendamentos"},
        {"key": "vendas", "label": "Vendas", "column": "Agendamentos com serviço"}
      ]
    }
  }
  ```
- `updated_at`

`metaStages` referenciam chaves do motor de métricas (`src/lib/metrics/formulas.ts`), nunca inventam número.

### `commercial_periods` — dados comerciais importados (genérico)
- `id`, `client_id`
- `start_date`, `end_date` (`YYYY-MM-DD`)
- `label` — texto original do período (ex.: `16/04 a 18/04`) preservado para exibição/depuração
- `row_json` — linha crua completa do CSV (todas as colunas, formato original)
- `source` — `csv` (futuro: outra origem)
- `created_at`
- **Idempotência:** `UNIQUE (client_id, start_date)` com upsert (reimportar não duplica; período sobreposto → mais recente prevalece).

Valores das etapas **não** são colunas promovidas: são lidos de `row_json` via `config_json` na hora da agregação. Isso mantém a importação simples (guarda cru) e o mapeamento editável sem reimportar.

### Migração de dados
- Backfill: para cada linha de `external_weekly_data` da Maria Maria, criar `commercial_periods` equivalente (reconstruindo `row_json` a partir das colunas) e semear `funnel_configs` da Maria Maria com o mapeamento acima.
- `external_weekly_data` **permanece intacta** (não dropar) — rede de segurança; a UI atual continua lendo dela até 2B migrar a leitura. Zero mudança visível.

## Parsing (novo `src/lib/csv/commercial.ts`)

- **Números BR:** `"1.359,90"`/`"284,9"`/`260` → number; `"7,14%"` ignorado (taxas não são etapas).
- **Período `DD/MM a DD/MM`:** separar início/fim; inferir ano — usa ano corrente; se o intervalo cair no futuro relativo à data de importação, assume ano anterior. `label` cru sempre preservado para correção manual futura.
- Reaproveitar `normalizeDateToISO` existente onde aplicável.

## Importação + mapeamento (UX)

Na área "Atualizar dados" do cliente, um segundo uploader: **"Dados comerciais (CSV)"** (separado do CSV do Meta).

1. Upload → sistema lê os cabeçalhos.
2. Se **não há** `funnel_configs` para o cliente: tela de mapeamento guiada — para cada coluna detectada, um seletor "esta coluna é: Período / Etapa (nome) / Faturamento / Ticket médio / Ignorar". Ordena etapas. Salva em `funnel_configs`.
3. Se **já há** config: aplica automaticamente, mostra resumo do mapeamento detectado com opção "ajustar mapeamento".
4. Grava períodos em `commercial_periods` (upsert) e registra a importação em `csv_imports` (reutiliza infra da Fase 1).

## Camada de servidor (código só em `src/lib/server/`)

- `src/lib/server/commercial.ts` — repositório de `commercial_periods` (upsert, leitura por cliente/período).
- `src/lib/server/funnel-config.ts` — ler/gravar `funnel_configs`.
- `src/lib/csv/commercial.ts` — parsing puro (testável isolado).
- Server functions em `api.ts` (import dinâmico dos módulos server): `fetchFunnelConfig`, `saveFunnelConfig`, `importCommercialCsv`, `fetchCommercialData`.

## Testes (vitest-pool-workers)

Manter os 43 atuais verdes + novos:
- Upsert idempotente de `commercial_periods` (reimportar 2× não duplica; período sobreposto atualiza).
- Salvar/ler `funnel_configs`.
- Parsing: números BR, intervalo de datas sem ano, colunas de taxa ignoradas.
- Backfill: `external_weekly_data` → `commercial_periods` produz os mesmos números.

## Fora de escopo (fica para 2B/2C)

- Visualização do funil unido Meta+comercial e perdas por etapa (2B).
- ROAS/CAC reais na tela (2B).
- Comparador de períodos (2C).
- Trocar a leitura da UI atual da Maria Maria para a nova fonte (2B faz a virada com segurança).

## Riscos / decisões

- **Ano ausente no período:** inferência pode errar em virada de ano; mitigado pelo `label` cru + possibilidade de reimportar/ajustar. Aceito para 2A.
- **Não dropar `external_weekly_data` agora:** evita risco de perda; dívida a limpar em 2B após a virada.
- Financeiro em BRL (`REAL`); datas `YYYY-MM-DD` em America/Sao_Paulo.
