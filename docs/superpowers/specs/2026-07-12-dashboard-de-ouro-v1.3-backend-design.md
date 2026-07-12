# Dashboard de Ouro v1.3 — Backend, Histórico e Integração Meta

**Data:** 2026-07-12
**Branch:** `v1.3-backend`
**Status:** Aprovado por Thallys (design validado em sessão de brainstorming)

## Objetivo

Evoluir o Dashboard de Ouro de uma ferramenta stateless (CSV → memória → render) para um sistema com persistência: clientes fixos, histórico acumulado de dados de anúncios, comparação de períodos, visão de longo prazo e — na Fase 2 — atualização de dados direto da Meta Marketing API com um clique.

**Contexto de uso:** Thallys (gestor de tráfego, único usuário) apresenta dashboards aos clientes a cada 15/30 dias. Hoje cada apresentação exige exportar CSV, subir e configurar do zero; nada é salvo entre sessões.

## Decisões tomadas

| Decisão | Escolha |
|---|---|
| Acesso | Somente o gestor (sem login de clientes nesta versão; área do cliente é possibilidade futura) |
| Histórico | Foco em comparação de períodos e visão de longo prazo (não em "congelar" relatórios) |
| Acesso Meta | Todas as contas estão no Business Manager do gestor — um único token de system user cobre tudo |
| Volume | 4 clientes ativos hoje, 10–15 projetados em 12 meses |
| Atualização | Incremental: busca desde a última atualização, acumulando histórico |
| CSV | Continua como backup/alternativa após a API |
| Leads | Rastreamento existente (v1.1) passa a persistir no banco. NÃO é um CRM — apenas persistência da tela atual |
| Estratégia | **Opção A — duas fases:** Fase 1 (banco + clientes + histórico, alimentado por CSV) e Fase 2 (botão "Atualizar via Meta") |

## Arquitetura

**Stack atual:** TanStack Start (React 19) + Vite, Cloudflare Workers, shadcn/ui + Tailwind v4, Recharts, PapaParse.

**Novo componente:** Cloudflare D1 (SQLite serverless) como banco de dados, acessado via server functions do TanStack Start rodando no Worker. Sem serviço externo, sem custo adicional, mesma conta Cloudflare (`894017f8d5df2b9641112ff9d3fc2446`).

**Fluxo de dados (novo):**

```
Fase 1: CSV upload → parse/normalize (código existente) → gravação no D1 → dashboard lê do D1
Fase 2: botão "Atualizar" → Worker chama Meta Marketing API → normaliza → gravação no D1 (mesmo formato)
```

O parser/normalizador existente (`src/lib/csv/`) é preservado; muda apenas o destino (banco em vez de estado em memória).

## Modelo de dados (D1)

Quatro entidades principais:

### 1. `clients`
Cadastro fixo de clientes: nome, slug, logo/cor (opcional), ID da conta de anúncio Meta (ex: Aki Sushi `1067373311996985`), perfil de dashboard, datas de contrato, timestamp da última atualização de dados.

**Perfis de dashboard** (enum `dashboard_profile`):
- `pixel_sales` — vendas rastreadas por pixel; KPIs de compras, faturamento e ROAS direto da Meta (caso Aki Sushi: pixel no cardápio Anota AI)
- `whatsapp_external` — leads via WhatsApp + fonte de dados externa cruzada (caso Maria Maria: planilha semanal do salão com faturamento, agendamentos e contatos)

### 2. `ad_daily_insights`
Matéria-prima de tudo. Uma linha = cliente + dia + anúncio: spend, impressões, alcance, cliques, CTR, CPM, frequência, conversas, compras, valor de conversão, e hierarquia campanha/conjunto/anúncio.

**Regra de ouro (anti-duplicação):** chave única `(client_id, date, ad_id)`. Escritas usam upsert — dado novo para endereço existente **substitui** o antigo. Consequências garantidas:
- Subir o mesmo CSV duas vezes não duplica
- Períodos sobrepostos não duplicam
- API por cima de dados de CSV substitui (a fonte mais recente prevalece)
- Meta refina números retroativamente; re-buscar dias já gravados atualiza os valores

Coluna `source` (`csv` | `meta_api`) registra a origem de cada linha.

### 3. `external_weekly_data`
Dados externos por cliente (caso Maria Maria): uma linha por semana da planilha do salão — intervalo de datas, contatos WhatsApp, agendamentos, agendamentos com serviço, faturamento, ticket médio. Chave única `(client_id, start_date)` com upsert. Semanas antigas nunca precisam ser re-enviadas. A lógica de cruzamento existente em `maria-maria.ts` é preservada, lendo do banco.

### 4. `leads`
Persistência do rastreamento de leads existente na v1.1: cliente, identificação do lead, status (`qualificado`, `reuniao`, `proposta`, `fechado`, `perdido`), datas. Marcações persistem entre sessões/reuniões. Escopo limitado à tela atual — sem funcionalidades de CRM.

## Interface (Fase 1)

### Painel de Clientes (nova rota `/`, home)
- Cards de clientes: nome, logo, "dados até DD/MM", alerta visual quando dados estão desatualizados (> 7 dias)
- Botão "+ Novo cliente" → formulário de cadastro
- Clique no card → dashboard do cliente

### Dashboard do cliente (rota `/dashboard/$clientSlug`)
Mantém tudo da v1.1/v1.2 (KPIs, gráficos, filtros, brush/zoom, diagnósticos, modo de análise) com adições:

1. **Seletor de período livre** — qualquer janela sobre o histórico acumulado ("últimos 30 dias", mês específico, "desde o início")
2. **Comparação de períodos** — dois períodos lado a lado: KPIs com variação percentual (↑/↓) e séries temporais sobrepostas
3. **Visão de longo prazo** — evolução mensal desde o início do contrato: investimento, resultado, custo por resultado
4. **"Atualizar dados"** — na Fase 1, abre o upload de CSV (que grava no banco); na Fase 2, vira o botão que chama a API (CSV permanece como opção secundária)

### Por perfil
- **Aki Sushi (`pixel_sales`):** KPIs centrados em compras/faturamento/ROAS
- **Maria Maria (`whatsapp_external`):** visão semanal existente (Meta + salão) preservada; upload da planilha do salão grava em `external_weekly_data`; longo prazo cruza investimento vs faturamento real

### Clientes iniciais (seed)
Maria Maria e Aki Sushi cadastrados desde o início, cada um com seu perfil.

## Fase 2 — Meta Marketing API

**Setup (manual, guiado, ~30 min, sem revisão de app da Meta):**
1. Criar app em developers.facebook.com vinculado ao BM da Audiência de Ouro (app permanece em modo desenvolvimento — suficiente para uso interno)
2. Criar system user no Business Manager com acesso de leitura às contas de anúncio
3. Gerar token de longa duração com escopo `ads_read` → armazenado como secret criptografado no Cloudflare Workers (nunca no código, nunca no cliente)

**Botão "Atualizar dados":**
- Worker chama `/{ad_account_id}/insights` com breakdown diário e nível de anúncio, do dia da última atualização (inclusive — a Meta refina retroativamente) até hoje
- Resposta normalizada para o mesmo formato de `ad_daily_insights` e gravada via upsert
- Campos por perfil: conversas iniciadas (WhatsApp) para Maria Maria; compras e valor de conversão (pixel) para Aki Sushi
- `last_synced_at` do cliente atualizado ao final

**Tratamento de erros:** falhas da API (Meta indisponível, token expirado, rate limit) exibem mensagem clara em português; a gravação é atômica por sincronização — erro no meio não corrompe dados existentes; CSV permanece como fallback. Token expirado gera instrução de renovação.

**Custo:** zero (API gratuita; volume de 10–15 contas é irrisório frente aos rate limits).

## Fora de escopo (desta versão)

- Login/área de clientes (futuro)
- CRM (cadastro de leads, funil, follow-up — outros produtos resolvem isso)
- Google Ads (futuro; o modelo `ad_daily_insights` já comporta uma coluna `platform` para isso)
- Automação agendada de sincronização (atualização é manual por botão, por decisão)

## Testes

- Unidade: upsert/anti-duplicação (mesmo CSV 2x, períodos sobrepostos, API sobre CSV), agregações por período, comparação de períodos, parse da planilha do salão
- Integração: fluxo completo CSV → banco → dashboard para os dois perfis
- Fase 2: mock da Meta API para normalização e tratamento de erros

## Sequência de implementação

1. **Fase 1a:** D1 + schema + migrações; CRUD de clientes; painel de clientes; upload CSV gravando no banco
2. **Fase 1b:** dashboard lendo do banco; seletor de período; comparação; visão de longo prazo; leads persistidos; fluxo Maria Maria no banco
3. **Fase 2:** setup do app Meta (guiado); endpoint de sincronização; botão "Atualizar dados"; tratamento de erros

Cada fase gera um plano de implementação próprio (skill writing-plans).
