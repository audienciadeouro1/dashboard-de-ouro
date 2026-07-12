# Dashboard de Ouro — Instruções para Claude

## Contexto do projeto

Ao iniciar qualquer sessão neste repositório, leia obrigatoriamente a nota do Obsidian antes de qualquer ação:

**`C:\GitHub\audiencia-brain\wiki\areas\audiencia-de-ouro\dashboard-de-ouro.md`**

Ela aponta para as notas filhas (visão, arquitetura, roadmap, log de sessões). Ao encerrar uma sessão, atualize o log de sessões no brain com o que foi feito, decisões tomadas e próximo passo.

## O que é

Central de inteligência de gestão de tráfego pago da **Audiência de Ouro**. O gestor (Thallys, único usuário) importa CSVs do Meta Ads (e, para clientes WhatsApp, um CSV comercial semanal) e o sistema gera dashboards, funil real, diagnósticos, comparações e — nas fases futuras — decisões registradas, alertas, relatórios e o agente "Analista de Ouro".

**Objetivo:** transformar dados em diagnóstico, decisão, ação e aprendizado — não apenas mostrar gráficos.

**CRÍTICO:** somente dashboards de performance de tráfego pago. NADA de CRM, controle de leads individuais ou Kanban. Funil comercial só em agregado.

## Arquitetura atual (resumo)

- **Stack:** TanStack Start (React 19) + Vite · Cloudflare Workers · D1 (`dashboard-de-ouro`) · shadcn/ui + Tailwind v4 · Recharts · PapaParse · Vitest + vitest-pool-workers
- **Fluxo:** CSV → parse/normalize (`src/lib/csv/`) → server functions (`src/lib/api.ts`) → upsert idempotente no D1 (`src/lib/server/`) → dashboard lê do banco (`/dashboard/$clientSlug`)
- **Análise avulsa:** upload em memória (`src/lib/store.ts`) → `/dashboard`
- **Auth:** login único de gestor com cookie HTTPOnly (`/login`)
- Detalhes: `docs/dashboard-de-ouro/architecture.md` e `data-model.md`

## Regras não negociáveis

1. Não quebrar funcionalidades existentes; CSV permanece mesmo após a Meta API.
2. Atualização via Meta API é manual (botão), somente leitura; a IA sugere, o gestor executa.
3. Métricas calculadas deterministicamente pelo sistema; IA nunca inventa/calcula números. Respostas numéricas citam cliente, período, métrica, fonte e entidade.
4. Diagnósticos separam fato / evidência / hipótese / recomendação; sem dados → dizer claramente.
5. Todo dado vinculado a um cliente; escritas idempotentes (upsert); importar 2× não duplica.
6. BRL para valores; fuso America/Sao_Paulo para datas e comparações.
7. Identidade visual: fundo escuro, dourado, premium, responsivo. Nada visualmente desconectado.
8. Vendas sem atribuição = "Origem não identificada", sempre visíveis.

## Padrões de código

- Código de banco só em `src/lib/server/` (importado dinamicamente pelos handlers de `api.ts` — nunca importar estaticamente no cliente).
- Novos módulos: tabela D1 (migração numerada em `migrations/`) + repositório em `server/` + server function em `api.ts` + rota/aba.
- Testes com vitest-pool-workers para toda lógica de banco e cálculo (`npm test`; 13 passando na linha de base).
- UI em português; textos de erro claros em PT-BR.
- Nunca fazer deploy sem o Thallys pedir (ele testa em localhost primeiro).

## Documentação detalhada

`docs/dashboard-de-ouro/`: `product-vision.md` · `architecture.md` · `data-model.md` · `ai-analyst.md` · `metrics-dictionary.md` · `roadmap.md` · `decisions.md` (registrar toda decisão relevante).

Roadmap: Fase 0 (auditoria ✅) → 1 fundação de dados → 2 funil/comparações → 3 diagnósticos/alertas → 4 memória estratégica → 5 Analista de Ouro → 6 relatórios · Meta API transversal.

## Infra

- **Hospedagem:** Cloudflare Workers (worker `tanstack-start-app`) · Conta `audienciadeouro1@gmail.com` (`894017f8d5df2b9641112ff9d3fc2446`)
- **Repositório:** principal `master`, desenvolvimento atual em `v1.3-backend`
