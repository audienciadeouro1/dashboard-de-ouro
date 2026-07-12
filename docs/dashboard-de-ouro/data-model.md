# Dashboard de Ouro — Modelo de Dados

**Última atualização:** 2026-07-12

## Estado atual (D1, migrações 0001–0003)

### `clients`
Cadastro de clientes: `id`, `name`, `slug` (único), `logo_url`, `color`, `meta_ad_account_id`, `dashboard_profile` (`sales` | `leads` | `awareness` | `engagement` | `video` | `custom` | `maria-maria`), `contract_start`, `last_synced_at`, `created_at`.

### `ad_daily_insights` — matéria-prima
Uma linha = cliente + dia + anúncio.

- Colunas promovidas: `spend`, `impressions`, `conversations`, `purchases`, `conversion_value`
- `row_json`: o `AdRow` completo (todas as ~35 métricas normalizadas do CSV)
- `source`: `csv` | `meta_api`
- **Chave de idempotência:** `UNIQUE (client_id, date, ad_key)` com upsert — mesmo CSV 2×, períodos sobrepostos e re-sincronizações não duplicam; a fonte mais recente prevalece
- `ad_key` = `campaignName|adSetName|adName` (limitação: renomes criam nova chave; a Meta API trará IDs reais)

### `external_weekly_data`
Dados comerciais semanais (caso Maria Maria): `start_date`/`end_date`, `contatos_whatsapp`, `agendamentos`, `agendamentos_com_servico`, `faturamento`, `ticket_medio`. `UNIQUE (client_id, start_date)` com upsert.

### `leads` (órfã)
Criada na 0001 para persistir a tela de leads da v1.1; a UI foi removida por decisão de escopo (sem CRM). Candidata a remoção ou repropósito.

## Modelo conceitual alvo (v2.0)

Evolução incremental — **não criar todas as tabelas de uma vez**; cada fase cria só o que usa.

| Tabela | Fase | Propósito |
|---|---|---|
| `clients` | ✅ existe | evolui com metas/limites (ou tabela `goals`) |
| `ad_daily_insights` | ✅ existe | ganha colunas promovidas extras (clicks, reach) e, na fase da API, IDs reais da Meta (`campaign_id`, `adset_id`, `ad_id`) |
| `csv_imports` | F1 | histórico de importações: cliente, arquivo, período, linhas gravadas/rejeitadas, data, origem |
| `meta_sync_runs` | API | histórico de sincronizações: conta, período, status, duração, contagens, erros |
| `commercial_imports` | F2 | importações do CSV comercial com modelo de mapeamento de colunas por cliente |
| `commercial_conversions` | F2 | conversões agregáveis do funil: data, estágio (conversa/qualificado/orçamento/venda), quantidade, valor, atribuição (campanha/conjunto/anúncio/UTM ou "origem não identificada"), telefone normalizado/hash quando necessário |
| `goals` | F3 | metas e limites por cliente e métrica (sem limites universais) |
| `diagnostics` | F3 | título, categoria, severidade, fato/evidência/hipótese/recomendação, período, entidades, confiança, status |
| `alerts` | F3 | regra disparada, severidade, métricas, período, status |
| `decisions` | F4 | tipo, entidade, motivo, métricas antes/depois, período de avaliação, resultado observado, status |
| `tasks` | F4 | título, prioridade, prazo, origem (diagnóstico/alerta/decisão/analista) |
| `analyst_conversations` / `analyst_messages` | F5 | histórico do Analista de Ouro |
| `knowledge_documents` / `knowledge_chunks` | F5 | base RAG curada (ou Cloudflare Vectorize) |
| `reports` | F6 | relatórios gerados e configurações |

## Regras transversais

- Granularidade diária para métricas da Meta; unicidade conceitual `conta + data + nível + id da entidade`.
- **Coluna `date` sempre `YYYY-MM-DD`** (ingestão normaliza via `normalizeDateToISO`; migração 0007 corrigiu dados legados em DD/MM/YYYY). O `row_json` preserva o formato original do CSV para exibição.
- **Qualidade de dados v1** (`server/quality.ts`) é calculada na hora a partir de `ad_daily_insights` — sem tabela própria. Pontuação explicável: dias sem dados (−3/dia, teto −30), dados desatualizados (>7d −10, >14d −20), colunas importantes ausentes (−5 cada, teto −25).
- Todo registro tem `client_id`; dados de clientes distintos nunca se misturam.
- Valores financeiros em BRL (`REAL` hoje; considerar centavos-inteiros se surgirem problemas de precisão).
- Datas TEXT `YYYY-MM-DD`, interpretadas em America/Sao_Paulo.
- Vendas sem atribuição → estágio com atribuição nula, exibidas como **"Origem não identificada"** (nunca ocultadas).
- Dados pessoais minimizados: telefone normalizado ou hash; não guardar dado sensível desnecessário.
