# Dashboard de Ouro — Visão de Produto

**Última atualização:** 2026-07-12

## O que é

Central de inteligência para gestão de tráfego pago da **Audiência de Ouro**. Evoluiu de um gerador de dashboards a partir de CSV do Meta Ads (v1.x) para um sistema que cruza dados de mídia, dados comerciais reais (WhatsApp/vendas), histórico de decisões e conhecimento especializado.

**O objetivo não é mostrar gráficos. É transformar dados em diagnóstico, decisão, ação e aprendizado.**

```
DADOS → DIAGNÓSTICO → DECISÃO → AÇÃO → RESULTADO → APRENDIZADO
```

## O problema

Para clientes que vendem pelo WhatsApp, a Meta informa quantas conversas foram iniciadas, mas **não** informa:

- Quantos contatos eram qualificados
- Quantos receberam orçamento
- Quantos compraram e quanto foi faturado
- Qual foi o verdadeiro retorno da campanha

Esses clientes enviam semanalmente um segundo CSV com dados comerciais. O sistema cruza mídia + comercial para revelar o funil real e o ROAS real.

## Perguntas que o sistema deve responder

- O que aconteceu? O que melhorou? O que piorou?
- Onde está o gargalo — anúncio, público, página ou atendimento?
- Qual campanha/anúncio traz vendas reais (não só conversas)?
- É seguro escalar?
- Qual foi o impacto das últimas decisões?
- O que apresentar ao cliente?

## Usuário

Thallys (gestor de tráfego, único usuário). Apresenta dashboards aos clientes a cada 15/30 dias. 4 clientes ativos hoje, 10–15 projetados em 12 meses. Sem acesso de clientes nesta fase.

## Formas de uso

1. **Meus Clientes** — clientes fixos com histórico persistido no D1
2. **Análise Rápida / Avulsa** — upload temporário em memória, sem cadastro

## Princípios não negociáveis

1. Não quebrar as funcionalidades atuais.
2. Importação de CSV da Meta permanece mesmo após a integração com a API.
3. Atualização via API da Meta é **manual e sob demanda** (botão "Atualizar dados"). Sem sincronização automática diária nesta versão.
4. Todo dado vinculado a um cliente (e conta de anúncios, quando aplicável).
5. Métricas calculadas de forma **determinística** pelo sistema — a IA não inventa números nem faz cálculo financeiro a partir de texto.
6. Toda resposta numérica da IA indica: cliente, período, métrica, fonte, entidade.
7. Sem dados suficientes → dizer isso claramente. Hipótese nunca é apresentada como fato.
8. Diagnósticos separam: **fato / evidência / hipótese / recomendação**.
9. Integração Meta **somente leitura** nesta fase. O Analista de Ouro sugere ações; o gestor executa manualmente. Nunca pausa campanha, altera orçamento ou modifica anúncio automaticamente.
10. Identidade visual preservada: fundo escuro, dourado como cor principal, aparência premium, responsiva.
11. Valores financeiros em **BRL**; datas e comparações no fuso **America/Sao_Paulo**.
12. **Sem CRM**: nada de controle de leads individuais, Kanban ou pipeline de vendas. O funil comercial agregado (conversas → qualificados → orçamentos → vendas) faz parte do escopo; o acompanhamento individual de leads não.

## Módulos planejados (v2.0)

| Módulo | Descrição |
|---|---|
| Funil Completo | Impressões → cliques → conversas → qualificados → orçamentos → vendas → faturamento, com taxas e perdas entre etapas |
| Diagnóstico Automático | Regras determinísticas que interpretam condições nos dados (fato/evidência/hipótese/recomendação) |
| Analista de Ouro | Agente IA com 3 camadas: dados reais (D1) + memória estratégica (decisões) + RAG de conhecimento |
| Central de Decisões | Registro de decisões com métricas antes/depois; nunca afirma causalidade automaticamente |
| Comparador | Períodos, antes/depois de decisão, entidade A vs B |
| Atualizar Dados | Botão de sincronização manual com a Meta Marketing API (idempotente) |
| Alertas Inteligentes | Regras configuráveis com metas por cliente (sem limites universais) |
| Relatórios | Técnico, cliente, WhatsApp, PDF, reunião — nunca enviados automaticamente |
| Central de Tarefas | Tarefas originadas de diagnósticos, alertas, decisões e do Analista |

Detalhes: [architecture.md](architecture.md) · [data-model.md](data-model.md) · [ai-analyst.md](ai-analyst.md) · [roadmap.md](roadmap.md) · [decisions.md](decisions.md)
