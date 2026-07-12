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
