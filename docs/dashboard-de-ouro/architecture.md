# Dashboard de Ouro — Arquitetura

**Última atualização:** 2026-07-12 (auditoria Fase 0, branch `v1.3-backend`)

## Stack (confirmada no código)

| Camada | Tecnologia |
|---|---|
| Framework | TanStack Start (React 19) + Vite 7 |
| Roteamento | TanStack Router (file-based, `src/routes/`) |
| Hospedagem | Cloudflare Workers (`wrangler.jsonc`, worker `tanstack-start-app`) |
| Banco | Cloudflare D1 (SQLite) — binding `DB`, database `dashboard-de-ouro` (`137270b8-6a8a-48dc-b2ad-d50edce17af9`) |
| UI | shadcn/ui (Radix) + Tailwind CSS v4 |
| Gráficos | Recharts 3 |
| CSV | PapaParse |
| Server functions | `createServerFn` do `@tanstack/react-start` |
| Testes | Vitest + `@cloudflare/vitest-pool-workers` (D1 real em miniflare) |
| Auth | Cookie HTTPOnly via server functions (`login`/`logout`/`checkSession`) |

Deploy: https://tanstack-start-app.audienciadeouro1.workers.dev · Conta Cloudflare `894017f8d5df2b9641112ff9d3fc2446`.

## Estrutura de pastas

```
src/
  routes/                  # file-based routing
    index.tsx              # home: painel de clientes + aba Análise Rápida
    login.tsx              # barreira de login
    dashboard.tsx          # LAYOUT (Outlet) + todo o código do dashboard (~2.800 linhas)
    dashboard.index.tsx    # /dashboard — dashboard em memória (análise avulsa / Maria Maria)
    dashboard.$clientSlug.tsx  # /dashboard/:slug — lê histórico do D1
    upload.$clientSlug.tsx # upload de CSV por cliente → grava no D1
  lib/
    api.ts                 # server functions (fetch/ingest/auth) — fronteira cliente↔servidor
    store.ts               # estado em memória (análise avulsa)
    csv/                   # pipeline de CSV (client-side)
      parser.ts            # parseCsvFile, datasetFromRows (reconstrói dataset a partir do D1)
      normalize.ts         # mapeamento de colunas do Meta → chaves canônicas (CanonicalKey)
      aggregate.ts         # aggregate, totals, timeSeries, parseDate
      diagnostics.ts       # diagnoseCampaigns, diagnoseAccount (regras determinísticas v1)
      maria-maria.ts       # cruzamento Meta × planilha do salão
      format.ts            # BRL, %, compacto
      types.ts             # AdRow, ParsedDataset, AnalysisMode, MariaMaria*
    server/                # só executa no Worker (importado dinamicamente por api.ts)
      db.ts                # getDb() — binding em prod, getPlatformProxy em dev
      clients.ts           # CRUD de clientes
      insights.ts          # upsert/consulta de ad_daily_insights (idempotente)
      external.ts          # upsert/consulta de external_weekly_data
  components/              # BrandHeader, ClientCard, NewClientDialog, UploadDropzone, dashboard/*, ui/* (shadcn)
migrations/                # 0001_schema, 0002_seed_clients, 0003_expand_profiles
test/                      # 13 testes (schema, clients, insights, external, seed)
```

## Fluxo de dados

**Clientes fixos:**
```
CSV upload (/upload/:slug) → parseCsvFile (browser) → ingestCsvRows (server fn)
  → upsertInsights (D1, chave client_id+date+ad_key) → touchLastSynced
Dashboard (/dashboard/:slug) → fetchClientData → getInsights (row_json) → datasetFromRows → render
```

**Análise avulsa:** `CSV → parse → store em memória → /dashboard (dashboard.index.tsx)`. Nada persiste.

**Maria Maria:** upload duplo (Meta + planilha do salão) cruzado em `maria-maria.ts`; semanas do salão persistem em `external_weekly_data`.

## Padrões importantes

- **Fronteira servidor:** código de `src/lib/server/` só entra no bundle do Worker; `api.ts` importa dinamicamente dentro dos handlers.
- **Idempotência:** toda escrita de insights é upsert com `UNIQUE (client_id, date, ad_key)`; `db.batch` é atômico por lote de 100.
- **`row_json`:** cada linha diária guarda o `AdRow` completo em JSON; as agregações acontecem em JS no cliente (não em SQL).
- **Isolamento por cliente:** `DashboardContext` em `dashboard.tsx` evita vazamento de estado entre dashboards.

## Dívidas técnicas conhecidas (auditoria 2026-07-12)

1. **`dashboard.tsx` com ~2.800 linhas** — layout, KPIs, gráficos, filtros, diagnósticos e comparações num arquivo só. Precisa ser decomposto antes dos novos módulos.
2. **Credencial hardcoded** em `src/lib/api.ts` (`login`) — senha em texto plano no repositório. Migrar para secret do Worker + hash.
3. **`ad_key` baseado em nomes** (`campanha|conjunto|anúncio`) — renomear um anúncio cria linha nova (duplica histórico). A integração com a Meta API exigirá IDs reais; prever migração.
4. **Métricas dentro de `row_json`** — impossibilita agregação/filtro em SQL; tudo é carregado e somado no cliente. Aceitável no volume atual, limita o Analista de Ouro e o Comparador.
5. **`fetchClientData` retorna o histórico inteiro** — sem paginação/filtro de período no servidor; cresce sem limite.
6. **Sem tabela de contas de anúncios** — `meta_ad_account_id` é coluna de `clients`; suficiente hoje (1 conta/cliente), rever na Fase da API.
7. **Sem histórico de importações/sincronizações** — não há `meta_imports`/`meta_sync_runs`.
8. **Timezone** — datas guardadas como TEXT `YYYY-MM-DD`; `parseDate` usa horário local do browser. Padronizar America/Sao_Paulo.
9. **Tabela `leads` órfã** — existe no schema (0001) mas a UI foi removida por decisão de escopo (sem CRM). Remover ou repropositar como estágios agregados do funil.
10. **Perfis divergentes** — migração 0003 remapeou `pixel_sales`→`sales` e `whatsapp_external`→`maria-maria`, mas `api.ts` ainda checa `"whatsapp_external"`; unificar enum.

## Direção arquitetural (v2.0)

- Novos módulos (funil, diagnósticos, decisões, alertas, tarefas, relatórios, analista) seguem o mesmo padrão: **tabela D1 + repositório em `src/lib/server/` + server function em `api.ts` + rota/aba**.
- Métricas derivadas calculadas **no servidor** de forma determinística (novo módulo `src/lib/server/metrics.ts`), não pela IA.
- Meta Marketing API (leitura) entra como segunda fonte gravando no mesmo `ad_daily_insights` (`source = 'meta_api'`), reaproveitando a idempotência.
- Analista de Ouro: Workers AI ou API externa + RAG (Vectorize/D1); ver [ai-analyst.md](ai-analyst.md).
