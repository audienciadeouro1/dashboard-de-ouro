# Dashboard de Ouro — Registro de Decisões

Registro permanente de decisões arquiteturais e de produto. Toda decisão relevante ganha uma entrada: data, decisão, motivo, alternativas, impacto e limitações.

---

## 2026-07-12 — D1 como banco de dados

**Decisão:** Cloudflare D1 (SQLite serverless) acessado via server functions do TanStack Start.
**Motivo:** mesma conta Cloudflare, custo zero, sem serviço externo; volume (10–15 clientes) é pequeno.
**Alternativas:** Supabase/Postgres externo (mais poder, mais custo/complexidade), KV (sem SQL).
**Limitações futuras:** SQLite sem extensões vetoriais nativas — a RAG do Analista usará Vectorize ou tabela de chunks própria.

## 2026-07-12 — Idempotência por upsert com chave natural

**Decisão:** `UNIQUE (client_id, date, ad_key)` + upsert; a fonte mais recente prevalece (API sobrescreve CSV).
**Motivo:** subir o mesmo CSV 2× ou re-sincronizar períodos não pode duplicar; a Meta refina números retroativamente.
**Limitação conhecida:** `ad_key` usa nomes (campanha|conjunto|anúncio) — renomes criam nova série. Será migrado para IDs reais quando a Meta API entrar.

## 2026-07-12 — Meta via API própria (não MCP), somente leitura, atualização manual

**Decisão:** Meta Marketing API com system user token do BM próprio; botão "Atualizar dados"; sem sync automática diária; sem escrita (pausar/alterar).
**Motivo:** controle, custo zero, segurança; o gestor decide quando atualizar e executa as ações manualmente.

## 2026-07-12 — Escopo: sem CRM, sem leads individuais, sem Kanban

**Decisão:** removida a tela de leads da v1.1 e o escopo de CRM. O funil comercial entra apenas **agregado** (contagens por estágio/dia com atribuição), não como registro individual navegável.
**Motivo:** o produto é dashboard de performance de tráfego; CRM é outro produto.
**Impacto:** tabela `leads` (migração 0001) ficou órfã — decidir na Fase 1.1 entre remover ou repropositar.

## 2026-07-12 — Autenticação simples de gestor único

**Decisão:** login único com cookie HTTPOnly via server functions; sem área de clientes nesta versão.
**Limitação registrada na auditoria:** credencial hardcoded no código — mover para secret do Worker com hash (Fase 1.1).

## 2026-07-12 — v2.0: de gerador de dashboards a central de inteligência

**Decisão:** adotar a visão v2.0 (funil completo, diagnósticos, decisões, comparador, alertas, relatórios, tarefas e Analista de Ouro) em 6 fases + integração Meta, conforme [product-vision.md](product-vision.md) e [roadmap.md](roadmap.md).
**Motivo:** a Meta não informa o retorno real de clientes WhatsApp; cruzar mídia + comercial + decisões + conhecimento transforma dados em diagnóstico e ação.
**Alternativas consideradas:** implementar tudo de uma vez (rejeitado — risco de quebrar o atual); começar pelo Analista (rejeitado — IA sem fundação de dados determinística viola os princípios).
**Impacto técnico:** métricas migram progressivamente para cálculo no servidor; `dashboard.tsx` precisa ser decomposto antes dos novos módulos.

## 2026-07-12 — IA nunca calcula números

**Decisão:** todas as métricas são calculadas deterministicamente pelo backend; a IA consulta, interpreta e cita fonte/período/entidade. RAG ensina interpretação, nunca fornece números do cliente.
**Motivo:** confiabilidade — números errados numa reunião com cliente destroem a credibilidade do produto.

## 2026-07-12 — Analista de Ouro como agente externo no n8n (com RAG)

**Decisão:** o Analista de Ouro (Fase 5) será construído **fora do app**, como agente no n8n com RAG, usando modelos de linguagem cujos tokens de API o Thallys já possui. O app não terá camada de IA embutida.
**Motivo:** o Thallys já domina o n8n; evita acoplar custo e complexidade de IA ao Worker; troca de modelo/fornecedor fica livre.
**Impacto:** a Fase 5 no app se reduz a **expor dados de leitura para o n8n consumir** (endpoints autenticados); tabelas `analyst_conversations`/`knowledge_*` do modelo alvo ficam sob responsabilidade do n8n/RAG externa. A regra "IA nunca calcula números" permanece: o n8n consulta métricas prontas do backend.
**Alternativas:** IA embutida no Worker via API da Anthropic (rejeitada por ora — mais código e custo no app).

## 2026-07-12 — Fase 1 (fundação): Caminho A "motor primeiro", comportamento preservado

**Decisão:** executar os pendentes da Fase 1 na ordem: motor de métricas com testes → decompor `dashboard.tsx` → ligar seletor de datas ao servidor → qualidade de dados v1 (selo no topo + detalhes ao clicar). **A lógica atual é o gabarito**: números de hoje são a referência; a fase organiza e acrescenta, nunca altera resultado — o cruzamento de CSVs e a análise avulsa permanecem intactos.
**Motivo:** os testes de métricas viram rede de proteção da refatoração do dashboard (2.774 linhas); refatorar antes de ter testes seria arriscado.
**Detalhes:** [../superpowers/specs/2026-07-12-fase-1-fundacao-design.md](../superpowers/specs/2026-07-12-fase-1-fundacao-design.md)

## 2026-07-12 — Fase 4: memória estratégica sem afirmar causalidade

**Decisão:** registrar tarefas e decisões por cliente, vinculando-as opcionalmente a um diagnóstico ou alerta. Cada decisão salva uma foto das métricas do período de referência e compara com o período de acompanhamento.
**Motivo:** transformar diagnóstico em ação e preservar o aprendizado da operação, sem converter o dashboard em CRM ou atribuir automaticamente uma melhoria/piora a uma única ação.
**Impacto:** a interface usa a expressão “variação observada” e alerta que outros fatores podem ter influenciado o resultado.

## 2026-07-12 — Meta API: sincronização sob demanda

**Decisão:** substituir o upload manual de CSV por uma busca sob demanda na Graph API (botão "Atualizar via Meta"), somente leitura, com token único de System User do Business Manager (app novo dedicado) guardado como secret (`.dev.vars` / `wrangler secret`).
**Detalhes:** janela móvel de 30 dias por clique; o período sincronizado "pertence à API" (delete-and-replace) para não duplicar quando o nome do anúncio diverge do CSV. Eventos fixos por perfil: Compra (`purchase`/`omni_purchase`) para vendas; conversa iniciada (`messaging_conversation_started_7d`) para WhatsApp/Maria. CSV permanece como fallback de emergência; dados comerciais manuais (salão) intocados.
**Fora de escopo (por ora):** tela de escolher evento (só com conversão personalizada), sincronização agendada, histórico de importações da Meta, Google Ads.
**Detalhes:** [../superpowers/specs/2026-07-12-meta-api-sync-design.md](../superpowers/specs/2026-07-12-meta-api-sync-design.md)
