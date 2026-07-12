# Dashboard de Ouro — Dicionário de Métricas

**Última atualização:** 2026-07-12

Todas as métricas são calculadas deterministicamente pelo sistema (hoje em `src/lib/csv/aggregate.ts`; futuras em `src/lib/server/metrics.ts`). Valores financeiros em BRL; períodos em America/Sao_Paulo.

## Métricas de mídia (fonte: Meta — CSV ou API)

| Métrica | Cálculo | Observação |
|---|---|---|
| Investimento (spend) | soma | |
| Impressões | soma | |
| Alcance (reach) | soma por linha | ⚠️ soma de alcance diário superconta pessoas únicas; tratar como aproximação em períodos longos |
| Frequência | impressões ÷ alcance | recalculada no agregado, não média das linhas |
| Cliques (link) | soma | |
| CTR | cliques ÷ impressões × 100 | recalculada no agregado |
| CTR (todos) | cliques totais ÷ impressões × 100 | usado no preset Maria Maria |
| CPC | spend ÷ cliques | |
| CPM | spend ÷ impressões × 1000 | |
| Conversas | soma (`conversations`) | conversas de mensagem iniciadas |
| Custo por conversa | spend ÷ conversas | |
| Compras (Meta) | soma (`purchases`) | rastreadas por pixel |
| CPA | spend ÷ compras | |
| Faturamento (Meta) | soma (`conversion_value`) | valor de conversão do pixel |
| ROAS (Meta) | conversion_value ÷ spend | |
| Resultados | soma (`results`) | depende do objetivo da campanha (`resultIndicator`) |
| Custo por resultado | spend ÷ results | |
| Vídeo | plays, thruplays, 25/50/75/95% | somas |
| Engajamento | soma (reações, comentários, compartilhamentos) | |

## Métricas reais (fonte: dados comerciais / CSV do cliente)

| Métrica | Cálculo | Observação |
|---|---|---|
| Leads qualificados | soma (comercial) | |
| Orçamentos enviados | soma (comercial) | |
| Vendas reais | soma (comercial) | |
| Faturamento real | soma dos valores de venda | |
| Ticket médio | faturamento real ÷ vendas | |
| ROAS real | faturamento real ÷ spend | difere do ROAS Meta; sempre rotular qual é |
| CAC real / custo por venda real | spend ÷ vendas reais | |
| Custo por lead qualificado | spend ÷ qualificados | |
| Custo por orçamento | spend ÷ orçamentos | |

## Métricas de funil (taxas entre etapas)

Funil WhatsApp: Impressões → Cliques → Conversas → Qualificados → Orçamentos → Vendas → Faturamento

| Métrica | Cálculo |
|---|---|
| Taxa clique→conversa | conversas ÷ cliques × 100 |
| Taxa conversa→qualificado | qualificados ÷ conversas × 100 |
| Taxa qualificado→orçamento | orçamentos ÷ qualificados × 100 |
| Taxa orçamento→venda | vendas ÷ orçamentos × 100 |
| Taxa conversa→venda | vendas ÷ conversas × 100 |
| Perda absoluta por etapa | etapa N − etapa N+1 |
| Perda percentual por etapa | 1 − (etapa N+1 ÷ etapa N) |

## Regras de cálculo

- **Divisão por zero → métrica indefinida** (exibir "—", nunca 0 ou Infinity).
- Taxas e custos são **recalculados sobre os agregados**, nunca média de médias.
- Comparações usam períodos equivalentes (mesmo nº de dias); a diferença é exibida em absoluto e percentual.
- Vendas sem atribuição entram nos totais do cliente, mas não nos rankings por campanha/anúncio; a quantidade não atribuída é sempre exibida.
