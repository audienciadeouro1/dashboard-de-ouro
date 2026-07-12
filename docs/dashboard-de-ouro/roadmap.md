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
- [x] 1.3 Filtro de período no servidor (`fetchClientData` aceita `start`/`end`) + `clicks`/`reach` promovidos a colunas com backfill (migração 0006). Seletor de datas da UI ligado ao servidor via search params (2026-07-12); correção crítica: coluna `date` normalizada para YYYY-MM-DD (migração 0007 — CSVs PT-BR gravavam DD/MM/YYYY e quebravam o filtro)
- [x] 1.4 (2026-07-12) `src/lib/metrics/formulas.ts` (fórmulas puras, fonte única) + `src/lib/server/metrics.ts` (`getClientTotals`/`getClientTimeSeries` + `fetchClientMetrics`) com testes golden-master garantindo zero mudança de resultado
- [x] 1.5 (2026-07-12) Qualidade de dados v1: `src/lib/server/quality.ts` (dias sem dados, colunas ausentes, dados desatualizados; pontuação explicável, sem tabela nova) + selo `QualityBadge` no dashboard do cliente
- [x] 1.6 (2026-07-12) `dashboard.tsx` decomposto: 2.774 → ~395 linhas; 8 abas + tema + configs + KPIs + auxiliares + contexto em `src/components/dashboard/`

**FASE 1 CONCLUÍDA (2026-07-12).** Suíte: 43 testes.

⚠️ Antes do próximo deploy: `wrangler secret put AUTH_EMAIL` / `AUTH_PASSWORD` (trocar a senha antiga) e `wrangler d1 migrations apply dashboard-de-ouro --remote` (migrações 0004–**0007**).

## FASE 2 — Funil e comparações ✅ (2026-07-12)

- [x] CSV comercial com mapeamento de colunas por cliente e modelo salvo
- [x] Funil completo com taxas, perdas por etapa e leitura Meta/pixel ou comercial
- [x] Comparador de períodos (7/30 dias e personalizado)
- [x] Métricas reais: ROAS real, CAC real, ticket médio

## FASE 3 — Diagnósticos e alertas ✅ (2026-07-12)

- [x] Motor de regras determinísticas configuráveis (`src/lib/metrics/diagnostics.ts`), executado no servidor
- [x] Aba "Diagnóstico": fato/evidência/hipótese/recomendação, severidade e confiança
- [x] `goals` — metas e limites por cliente (sem limites universais), migração 0011
- [x] Alertas determinísticos: CPA acima do limite, ROAS abaixo da meta, CTR em queda e dados atrasados
- [ ] Ações "Criar tarefa" e "Registrar decisão" a partir de diagnóstico/alerta

Implementação da Fase 3: `ClientDiagnosticsTab`, `getClientDiagnostics` e `saveClientGoal`. As ações de tarefa/decisão permanecem para a Fase 4, quando existirão as tabelas `tasks` e `decisions`.

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
