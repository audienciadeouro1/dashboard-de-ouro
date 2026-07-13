# Meta API — Sincronização de métricas (busca sob demanda)

**Data:** 2026-07-12 · **Branch:** `v1.5-continuacao-nova-fase` · Fase transversal do roadmap ("Meta API"). Depende do pipeline de ingestão existente (`ad_daily_insights`, upsert idempotente).

## Objetivo
Substituir o upload manual de CSV do Meta Ads por uma busca sob demanda direto da Graph API: o gestor clica em **"Atualizar via Meta"** e o sistema grava as métricas de tráfego pago no mesmo banco/estrutura que o CSV já usa. Somente leitura; a IA sugere, o gestor executa. O CSV permanece como fallback de emergência.

## Escopo
- Botão **"Atualizar via Meta"** por cliente que busca os **últimos 30 dias** (janela móvel), dia a dia, no nível de anúncio.
- Configuração por cliente do **ID da conta de anúncios** (`act_...`) com botão **"Testar conexão"**.
- Clientes iniciais: **Maria Maria** (conversas WhatsApp) e **Aki Sushi** (compras/pixel). Cliente novo = só preencher o ID da conta depois.
- Origem gravada como `meta_api`; `clients.last_synced_at` atualizado a cada sincronização bem-sucedida.
- CSV do Meta continua disponível para todos (fallback).

## Fronteira de dados
- A Meta API alimenta **apenas** `ad_daily_insights` (tráfego pago). **Não toca** em `external_weekly_data` (dados comerciais manuais do salão) — continuam sendo digitados à mão e cruzados como hoje.

## Autenticação
- Um único **token de System User** do Business Manager do gestor, com acesso de leitura às contas de todos os clientes (todas estão no mesmo BM).
- App novo e dedicado na Meta for Developers (não reaproveita o app do n8n).
- Token em segredo: `.dev.vars` localmente, `wrangler secret` em produção. Nunca no cliente/navegador nem no código. Variáveis: `META_ACCESS_TOKEN`, `META_API_VERSION` (ex.: `v21.0`).

## Estratégia de gravação (sem duplicar)
- A sincronização é **"o período pertence à API"**: antes de gravar, `deleteInsightsInRange(clientId, start, end)` remove tudo do intervalo (csv **e** meta_api) para aquele cliente; em seguida faz upsert dos dados frescos com `source = "meta_api"`.
- Evita o risco de dupla contagem quando o nome do anúncio na API difere do nome no CSV. Dados de CSV **fora** da janela sincronizada ficam intactos como histórico.

## Arquitetura

### Puro/testável — `src/lib/meta/insights-map.ts`
- `META_INSIGHT_FIELDS: string[]` — lista de campos pedidos à Graph API (spend, impressions, reach, frequency, clicks, ctr, cpc, cpm, actions, action_values, video metrics, etc.).
- Constantes de mapeamento de ação por resultado:
  - Compra: `purchase` / `omni_purchase` (valor via `action_values`).
  - Conversa WhatsApp: `onsite_conversion.messaging_conversation_started_7d`.
- `metaInsightToAdRow(raw: MetaInsightRow): AdRow` — converte um registro dia+anúncio da API no `AdRow` canônico, extraindo conversões/valores das listas `actions`/`action_values` e preenchendo o máximo de campos que o painel já exibe. Determinístico, sem I/O.
- `extractAction(actions, type): number` / `extractActionValue(...)` — helpers de leitura das listas aninhadas.

### Servidor — `src/lib/server/meta.ts`
- `fetchMetaInsights(env, accountId, range): Promise<MetaInsightRow[]>` — chamada HTTP à Graph API (`/{account}/insights`, `level=ad`, `time_increment=1`, `since`/`until`), com paginação (`paging.next`) e tratamento de erro (JSON de erro da Meta → `Error` em PT-BR).
- `syncClientFromMeta(db, env, clientId, opts?: { days?: number }): Promise<{ days: number; ads: number; range: Range }>` — resolve `accountId` do cliente, calcula janela (default 30 dias até hoje, fuso America/Sao_Paulo), busca, mapeia via `metaInsightToAdRow`, `deleteInsightsInRange`, `upsertInsights(..., "meta_api")`, atualiza `last_synced_at`, registra em `csv_imports` (origem `meta_api`).
- `testMetaConnection(db, env, clientId): Promise<{ ok: true; accountName: string }>` — chamada leve (nome da conta) para validar token + acesso antes de sincronizar.
- `setClientMetaAccountId(db, clientId, accountId): Promise<void>` — grava/normaliza `act_...`.

### Reuso — `src/lib/server/insights.ts`
- Nova função `deleteInsightsInRange(db, clientId, start, end)` (usa índice existente `idx_insights_client_date`). `upsertInsights` já aceita `source`.

### Server functions — `src/lib/api.ts`
- `syncClientMeta({ slug, days? })`, `testClientMetaConnection({ slug })`, `saveClientMetaAccountId({ clientId, accountId })`. `serverDeps` passa a importar `./server/meta`; handlers acessam `env` (token/versão) via binding do Worker.

### UI
- No dashboard do cliente: botão **"Atualizar via Meta"** com estados carregando → sucesso ("X dias / Y anúncios") → erro (mensagem clara); exibe `last_synced_at` ("Última atualização: …", fuso SP).
- Área de configuração do cliente: campo **ID da conta** + botão **"Testar conexão"**. Estilo dark/dourado, responsivo.

## Tratamento de erros (mensagens PT-BR)
Token inválido/expirado · conta sem acesso/ID errado · limite de requisições da Meta atingido · Meta indisponível · período sem dados. Em qualquer falha: **não grava nada** (não apaga o período), mantém o estado anterior e orienta usar o CSV de emergência.

## Migração
Nenhuma nova migração necessária: `clients.meta_ad_account_id` e `clients.last_synced_at` já existem; `ad_daily_insights.source` já aceita `meta_api`.

## Testes (vitest-pool-workers + unit)
- `metaInsightToAdRow` e helpers de `actions`/`action_values` (unit): compra+valor (Aki), conversa WhatsApp (Maria), campos ausentes → 0.
- `deleteInsightsInRange` + `syncClientFromMeta` com `fetchMetaInsights` mockado: gravação idempotente, delete-and-replace não duplica, `last_synced_at` atualizado, isolamento por cliente.
- Manter os 81 testes atuais verdes.
- Validação manual: conferir números do Maria Maria contra o relatório do n8n antes de ligar o Aki.

## Ordem de construção
Motor genérico (map + fetch + sync) → testes → ligar/validar **Maria Maria** → ligar **Aki Sushi** → UI (botão, config, timestamp). Sem quebrar CSV nem funcionalidades existentes.

## Pré-requisitos do gestor (fora do código)
1. Criar app novo na Meta for Developers.
2. Criar System User no BM e gerar token com `ads_read` sobre as contas do Maria e Aki.
3. Fornecer os dois `act_...` (IDs das contas).
4. Colocar o token em `.dev.vars` (local) e `wrangler secret` (produção).

## Fora de escopo (YAGNI)
- Tela de escolher evento de conversão (só quando surgir cliente com conversão personalizada).
- Sincronização automática/agendada (mantém atualização manual por botão).
- "Buscar histórico completo" (janela de 30 dias resolve o dia a dia; pode vir depois).
- Escrita na Meta (pausar/ativar campanhas) — nunca nesta fase.
