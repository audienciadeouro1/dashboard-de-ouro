# Fase 1 — Fundação de dados: Design aprovado

**Data:** 2026-07-12 · **Branch:** `v1.4-nova-fase-sistema` · **Aprovado por:** Thallys

## Objetivo

Fechar os itens pendentes da Fase 1 do roadmap (1.4, 1.5, 1.6 + ligação do filtro de datas): motor de métricas no servidor com testes, decomposição do `dashboard.tsx`, seletor de período ligado ao servidor e qualidade de dados v1.

## Regra número um: comportamento preservado

**A lógica atual do sistema é o gabarito.** Os números exibidos hoje (dashboard por cliente e análise avulsa com cruzamento de CSVs) estão corretos e são a referência. Esta fase **organiza e acrescenta — nunca altera resultado**:

- Nenhuma fórmula muda de resultado; refatorações são comportamento-preservadas.
- O cruzamento de CSVs (Meta Ads + comercial/Maria Maria) continua funcionando exatamente como hoje.
- A análise avulsa em memória (`store.ts` → `/dashboard`) permanece intacta.
- Qualquer divergência de número após refatoração é bug e bloqueia a etapa.

## Ordem de execução (Caminho A — "motor primeiro")

Cada etapa termina com `npm test` passando (baseline de 13 testes + novos) e **checkpoint de teste manual do Thallys no localhost** antes da próxima. Sem deploy em nenhuma etapa.

### Etapa 1 — Motor de métricas

- `src/lib/metrics/` — fórmulas puras (sem banco): CTR, CPC, CPM, CPA, custo por conversa, ROAS, ticket médio etc., extraídas da lógica existente (`src/lib/csv/aggregate.ts` e cálculos inline do `dashboard.tsx`) **sem mudar resultados**. Fonte única usada pelo fluxo persistido e pela análise avulsa.
- `src/lib/server/metrics.ts` — lê o D1 e aplica as fórmulas no servidor (código de banco só em `server/`, importado dinamicamente pelos handlers de `api.ts`).
- **Testes de precisão** (vitest-pool-workers): divisão por zero → valor nulo exibido como "—" (nunca NaN/Infinity), arredondamento consistente, BRL, casos extraídos de dados reais atuais como golden-master.
- Critério de aceite: tela idêntica à atual; testes cobrindo cada fórmula.

### Etapa 2 — Decompor `dashboard.tsx` (~2.774 linhas)

- Quebrar em componentes por aba/seção em `src/components/dashboard/`, consumindo o motor de métricas da Etapa 1.
- Zero mudança visual ou de comportamento; os testes da Etapa 1 são a rede de proteção.
- Critério de aceite: todas as abas idênticas às atuais em navegação manual; testes passando.

### Etapa 3 — Seletor de datas ligado ao servidor

- Ligar o seletor de período da UI ao filtro `start`/`end` já existente em `fetchClientData` (fuso America/Sao_Paulo).
- Critério de aceite: trocar período recarrega dados do banco coerentes com o intervalo; análise avulsa não é afetada.

### Etapa 4 — Qualidade de dados v1

- `src/lib/server/quality.ts` — para cliente + período selecionado, calcula na hora (sem tabela nova): **dias sem dados**, **colunas ausentes** no CSV importado (via `row_json`/`csv_imports`), **dados desatualizados** (última importação antiga).
- Pontuação explicável: a nota sempre acompanha a lista dos motivos.
- UI: selo discreto no topo do dashboard do cliente (dourado = ok / âmbar = atenção / vermelho = problema); clique abre detalhes em PT-BR claro. Identidade visual premium mantida.
- Critério de aceite: CSV com buracos proposital gera avisos corretos; período completo gera selo dourado; testes de cálculo da pontuação.

## Fora de escopo desta fase

- Meta API (transversal, decisão posterior do Thallys).
- Funil comercial, comparações, diagnósticos, alertas (Fases 2–3).
- Tabelas novas ou migrações de banco.
- Analista de Ouro: decisão registrada — será **agente externo no n8n com RAG** (tokens de API do Thallys); o app só precisará, no futuro, expor dados para consumo. Nada a fazer nesta fase.

## Tratamento de erros

- Períodos sem dados → mensagem clara "sem dados no período", nunca tela quebrada.
- Divisões por zero → "—".
- Textos de erro em PT-BR.

## Testes

- vitest-pool-workers para toda lógica de banco e cálculo.
- Baseline: 13 testes existentes continuam passando em todas as etapas.
- Novos: precisão de métricas (Etapa 1) e pontuação de qualidade (Etapa 4).
