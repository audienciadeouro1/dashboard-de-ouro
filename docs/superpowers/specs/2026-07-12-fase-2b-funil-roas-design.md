# Fase 2B — Funil real + ROAS/CAC reais

**Data:** 2026-07-12
**Branch:** `v1.4-nova-fase-sistema`
**Depende de:** Fase 2A (tabelas `commercial_periods` + `funnel_configs`, parsing comercial).

## Objetivo

Unir dados do Meta Ads + dados comerciais num **funil real por período**, com taxas de conversão e perdas por etapa, e mostrar **ROAS, CAC e ticket reais**. Aditivo: não altera a exibição atual da Maria Maria (que segue lendo `external_weekly_data`); `external_weekly_data` permanece.

## Escopo

- Nova aba **"Funil"** no dashboard do cliente, exibida **somente** quando o cliente tem `funnel_configs` + ao menos um `commercial_periods`.
- Cálculo determinístico no servidor; a UI não inventa números.
- Respeita o filtro de datas atual do dashboard (`?start=&end=`).

## Modelo do funil

Etapas ordenadas = `metaStages` (do Meta) seguidas das `commercial.stages` (do CSV comercial), na ordem da config:
`Impressões → Cliques → Conversas iniciadas → Contatos WhatsApp → Agendamentos → Vendas`.

- **Etapas Meta:** contagem vem de `Totals` (motor de métricas existente). Chaves suportadas mapeadas para campos de `Totals`: `impressions`, `clicks`, `conversations`, `reach`, `purchases`.
- **Etapas comerciais:** soma de `parseBRNumber(row[column])` sobre os `commercial_periods` que **se sobrepõem** ao período filtrado (período `[s,e]` entra se `s <= rangeEnd && e >= rangeStart`; sem filtro → todos). Não há corte parcial de período (granularidade é o período inteiro).
- **Venda:** última etapa comercial (convenção). `sales` = contagem dessa etapa.
- **Faturamento:** soma de `parseBRNumber(row[revenueColumn])` dos mesmos períodos.

### Derivados (por etapa e topo)
- Por etapa (a partir da 2ª): `conversão = etapa / etapaAnterior` (0 se anterior = 0); `perda = etapaAnterior − etapa` (nunca negativa; se etapa > anterior, perda = 0 e conversão pode passar de 100% — sinal honesto, ver abaixo).
- **ROAS real** = faturamento ÷ investimento.
- **CAC real** = investimento ÷ vendas.
- **Ticket real** = faturamento ÷ vendas.
- Todas as divisões por zero → 0 (consistente com `formulas.ts`).

### Sinal de handoff Meta↔comercial
"Conversas iniciadas" (Meta) e a 1ª etapa comercial ("Contatos WhatsApp") medem quase o mesmo por caminhos distintos. A transição entre elas é exibida com rótulo próprio ("Meta contou X conversas; o negócio registrou Y contatos") e **não** é tratada como perda de funil pura — só informada. Vira diagnóstico na Fase 3.

## Arquitetura

- **Puro/testável** `src/lib/metrics/funnel.ts`:
  - `type FunnelStage = { key: string; label: string; source: "meta" | "commercial"; count: number }`
  - `type FunnelStageResult = FunnelStage & { conversionFromPrev: number | null; dropFromPrev: number | null }`
  - `interface FunnelResult { stages: FunnelStageResult[]; spend: number; revenue: number; sales: number; roas: number; cac: number; ticket: number }`
  - `deriveFunnel(stages: FunnelStage[], spend: number, revenue: number): FunnelResult` — calcula conversões/perdas + ROAS/CAC/ticket. Divisões seguras.
- **Servidor** `src/lib/server/funnel.ts`:
  - `getClientFunnel(db, clientId, range?): Promise<FunnelResult | null>` — retorna `null` se não houver config. Junta `getClientTotals` (Meta) + `getCommercialPeriods` filtrados por sobreposição; monta `FunnelStage[]` (meta por chave→campo de Totals; comercial somando colunas); chama `deriveFunnel`.
- **Server function** em `api.ts`: `fetchClientFunnel({ slug, start, end })` → resolve cliente por slug e chama `getClientFunnel`.
- **UI** `src/components/dashboard/FunnelTab.tsx`: KPIs (ROAS/CAC/ticket/faturamento/investimento) + funil vertical com barras proporcionais, conversão e perda por etapa, e o cartão de handoff. Estilo dark/dourado. Aba adicionada em `dashboard.tsx` e alimentada pelo loader de `dashboard.$clientSlug.tsx` (nova chamada `fetchClientFunnel`, só quando aplicável).

## Testes (vitest-pool-workers + unit)

- `deriveFunnel`: conversões/perdas corretas; ROAS/CAC/ticket; divisão por zero → 0; etapa maior que anterior (perda 0).
- `getClientFunnel`: sobreposição de períodos com o range; soma de colunas comerciais com números BR; retorna null sem config; vendas = última etapa comercial.
- Manter os 56 testes atuais verdes.

## Fora de escopo (fica para depois)

- Comparador de períodos (Fase 2C).
- Aposentar `external_weekly_data` / migrar a Overview da Maria Maria (decisão: manter aditivo).
- Diagnóstico automático do gap Meta↔comercial (Fase 3).

## Regras

- Financeiro BRL; datas `YYYY-MM-DD`, America/Sao_Paulo. Código de banco só em `server/`. Sem deploy sem pedido. UI em PT-BR.
