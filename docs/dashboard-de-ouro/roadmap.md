# Dashboard de Ouro — Roadmap v2.0

**Última atualização:** 2026-07-12

Desenvolvimento em fases. Não implementar tudo de uma vez; cada fase gera plano próprio e termina com testes passando e deploy aprovado pelo Thallys (nunca deployar sem pedido).

## FASE 0 — Auditoria e documentação ✅ (2026-07-12)

- [x] Inspeção completa do repositório (stack, rotas, dados, dívidas)
- [x] Documentação permanente (`docs/dashboard-de-ouro/`)
- [x] CLAUDE.md atualizado
- [x] Roadmap e registro de decisões
- [x] Notas no brain (mãe + filhas)

## FASE 1 — Fundação dos dados (parcialmente feita nas v1.3 Fase 1a/1b)

Já existe: D1, `clients`, `ad_daily_insights` idempotente, `external_weekly_data`, upload por cliente, dashboard lendo do banco, login, 13 testes.

Pendente:
- [x] 1.1 Saneamento (2026-07-12, branch `v1.4-nova-fase-sistema`): senha movida para secrets (AUTH_EMAIL/AUTH_PASSWORD via wrangler secret + .dev.vars), enum de perfis unificado (`DashboardProfile` = `AnalysisMode`, legados `pixel_sales`/`whatsapp_external` removidos), tabela `leads` removida (migração 0004)
- [x] 1.2 `csv_imports` — histórico de importações (migração 0005 + `server/imports.ts` + registro automático nas ingestões)
- [x] 1.3 Filtro de período no servidor (`fetchClientData` aceita `start`/`end`) + `clicks`/`reach` promovidos a colunas com backfill (migração 0006). Falta ligar o seletor de datas da UI ao filtro do servidor (junto com 1.6)
- [ ] 1.4 Módulo `src/lib/server/metrics.ts` — cálculos determinísticos no servidor com testes de precisão
- [ ] 1.5 Qualidade de dados v1: dias sem dados, colunas ausentes, dados desatualizados (pontuação explicável)
- [ ] 1.6 Decompor `dashboard.tsx` (~2.800 linhas) em componentes por aba — pré-requisito para os novos módulos

⚠️ Antes do próximo deploy: `wrangler secret put AUTH_EMAIL` / `AUTH_PASSWORD` (trocar a senha antiga) e `wrangler d1 migrations apply dashboard-de-ouro --remote` (migrações 0004–0006).

## FASE 2 — Funil e comparações

- [ ] CSV comercial com mapeamento de colunas por cliente (pré-visualização, validação, duplicados, erros por linha, modelo salvo)
- [ ] `commercial_conversions` (estágios: conversa, qualificado, orçamento, venda) com atribuição opcional
- [ ] Funil completo com taxas, perdas por etapa e maior ponto de perda destacado
- [ ] "Origem não identificada" sempre visível
- [ ] Comparador de períodos (semana×semana, mês×mês, personalizado) e entidade A×B
- [ ] Métricas reais: ROAS real, CAC real, ticket médio

## FASE 3 — Diagnósticos e alertas

- [ ] Motor de regras determinísticas configuráveis (evolução de `diagnostics.ts`)
- [ ] Aba "Diagnóstico": fato/evidência/hipótese/recomendação, severidade, confiança, status
- [ ] `goals` — metas e limites por cliente (sem limites universais)
- [ ] Central de alertas (CPA acima do limite, ROAS abaixo da meta, CTR em queda, dados atrasados…)
- [ ] Ações "Criar tarefa" e "Registrar decisão" a partir de diagnóstico/alerta

## FASE 4 — Memória estratégica

- [ ] `decisions` — registro com métricas antes/depois e período de avaliação
- [ ] `tasks` — central de tarefas com origem rastreada
- [ ] Análise antes/depois sem afirmar causalidade

## FASE 5 — Analista de Ouro

- [ ] Consultas estruturadas (a IA consulta, o backend calcula)
- [ ] Classificação de perguntas e fluxo interno (ver [ai-analyst.md](ai-analyst.md))
- [ ] RAG curada de conhecimento de tráfego
- [ ] Análises proativas pós-importação/sincronização
- [ ] Histórico de conversas + eval set

## FASE 6 — Relatórios

- [ ] Relatório técnico, simplificado, resumo WhatsApp, PDF, texto de reunião, resumo semanal
- [ ] Revisão antes de exportar; nunca envio automático

## Integração Meta Marketing API (transversal, "Fase 2" da spec v1.3)

- [ ] App Meta + system user token (`ads_read`) como secret do Worker
- [ ] Botão "Atualizar dados": manual, incremental, idempotente, com `meta_sync_runs`
- [ ] IDs reais da Meta em `ad_daily_insights` (substituindo `ad_key` por nomes)
- [ ] CSV permanece como fallback

Encaixa naturalmente após a Fase 1 (fundação) ou em paralelo à Fase 2, por decisão do Thallys.
