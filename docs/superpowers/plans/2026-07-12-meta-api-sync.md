# Meta API — Sincronização de métricas · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o upload manual de CSV do Meta Ads por uma busca sob demanda na Graph API — o gestor clica em "Atualizar via Meta" e as métricas de tráfego pago entram no banco pelo mesmo pipeline do CSV.

**Architecture:** Módulo puro de mapeamento (`src/lib/meta/`) converte a resposta da Graph API em `AdRow`; um repositório de servidor (`src/lib/server/meta.ts`) busca (HTTP), apaga o período e regrava com `source = "meta_api"`; server functions em `api.ts` expõem sincronizar/testar/salvar-conta; a UI vive na página de upload junto do CSV (fallback).

**Tech Stack:** TanStack Start (React 19), Cloudflare Workers, D1, vitest-pool-workers, Graph API (fetch nativo).

## Global Constraints

- **Somente leitura** da Meta; nunca escrever (pausar/ativar) — nesta fase, jamais.
- **Idempotência:** sincronizar 2× o mesmo período não duplica (delete-and-replace por intervalo).
- Métricas **determinísticas**; nada de números inventados. Datas em `YYYY-MM-DD`, fuso `America/Sao_Paulo`.
- Código de banco/rede só em `src/lib/server/`; nunca importado estaticamente no cliente (usar `serverDeps()` dinâmico).
- Token só em segredo (`.dev.vars` local / `wrangler secret` produção). Nunca no bundle do cliente, nunca no código.
- UI em português; mensagens de erro claras em PT-BR.
- Manter os **81 testes** atuais verdes. `npm test` roda tudo.
- Não fazer deploy (Thallys testa em localhost e pede o deploy).

---

### Task 1: Helpers de data (janela móvel)

**Files:**
- Modify: `src/lib/dates.ts`
- Test: `test/dates.test.ts`

**Interfaces:**
- Produces: `addDaysISO(iso: string, delta: number): string` (aritmética em UTC, sem drift de fuso); `todayInSaoPaulo(): string` (hoje em `YYYY-MM-DD` no fuso SP).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `test/dates.test.ts` (o arquivo já existe e testa `normalizeDateToISO`):

```ts
import { addDaysISO } from "../src/lib/dates";

describe("addDaysISO", () => {
  it("subtrai dias atravessando o mês", () => {
    expect(addDaysISO("2026-07-01", -1)).toBe("2026-06-30");
  });
  it("soma dias atravessando o ano", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("janela de 30 dias termina no mesmo dia", () => {
    expect(addDaysISO("2026-07-30", -(30 - 1))).toBe("2026-07-01");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- dates`
Expected: FAIL — `addDaysISO is not a function`.

- [ ] **Step 3: Implementar**

Adicionar ao final de `src/lib/dates.ts`:

```ts
/** Soma (ou subtrai) dias a uma data YYYY-MM-DD, em UTC para evitar drift de fuso. */
export function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- dates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts test/dates.test.ts
git commit -m "feat: helpers addDaysISO e todayInSaoPaulo para janela movel"
```

---

### Task 2: Mapeamento puro Graph API → AdRow

**Files:**
- Create: `src/lib/meta/insights-map.ts`
- Test: `test/meta-insights-map.test.ts`

**Interfaces:**
- Consumes: `AdRow` de `../csv/types`, `DashboardProfile` de `../server/clients`.
- Produces:
  - `interface MetaAction { action_type: string; value: string }`
  - `interface MetaInsightRow { date_start: string; date_stop: string; campaign_name?: string; adset_name?: string; ad_name?: string; spend?: string; impressions?: string; reach?: string; frequency?: string; clicks?: string; ctr?: string; cpc?: string; cpm?: string; actions?: MetaAction[]; action_values?: MetaAction[] }`
  - `META_INSIGHT_FIELDS: string[]`
  - `PURCHASE_ACTIONS: string[]`, `WHATSAPP_CONVERSATION_ACTION: string`
  - `resultKindForProfile(profile: DashboardProfile): "purchases" | "conversations"`
  - `sumActions(list: MetaAction[] | undefined, types: string[]): number`
  - `metaInsightToAdRow(raw: MetaInsightRow, profile: DashboardProfile): AdRow`

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/meta-insights-map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { metaInsightToAdRow, sumActions, resultKindForProfile } from "../src/lib/meta/insights-map";
import type { MetaInsightRow } from "../src/lib/meta/insights-map";

const base: MetaInsightRow = {
  date_start: "2026-07-01",
  date_stop: "2026-07-01",
  campaign_name: "C",
  adset_name: "A",
  ad_name: "Ad",
  spend: "100",
  impressions: "1000",
  reach: "800",
  frequency: "1.25",
  clicks: "50",
  ctr: "5",
  cpc: "2",
  cpm: "100",
};

describe("sumActions", () => {
  it("soma só os tipos pedidos e ignora ausentes", () => {
    const actions = [
      { action_type: "purchase", value: "4" },
      { action_type: "link_click", value: "50" },
    ];
    expect(sumActions(actions, ["purchase", "omni_purchase"])).toBe(4);
    expect(sumActions(undefined, ["purchase"])).toBe(0);
  });
});

describe("resultKindForProfile", () => {
  it("vendas => compras; maria-maria/leads => conversas", () => {
    expect(resultKindForProfile("sales")).toBe("purchases");
    expect(resultKindForProfile("maria-maria")).toBe("conversations");
    expect(resultKindForProfile("leads")).toBe("conversations");
  });
});

describe("metaInsightToAdRow", () => {
  it("mapeia compra + valor (perfil vendas) e deriva ROAS/CPA", () => {
    const raw: MetaInsightRow = {
      ...base,
      actions: [{ action_type: "purchase", value: "4" }],
      action_values: [{ action_type: "purchase", value: "600" }],
    };
    const row = metaInsightToAdRow(raw, "sales");
    expect(row.date).toBe("2026-07-01");
    expect(row.campaignName).toBe("C");
    expect(row.spend).toBe(100);
    expect(row.clicks).toBe(50);
    expect(row.purchases).toBe(4);
    expect(row.conversionValue).toBe(600);
    expect(row.results).toBe(4);
    expect(row.roas).toBe(6);
    expect(row.cpa).toBe(25);
    expect(row.averageConversionValue).toBe(150);
  });

  it("mapeia conversa WhatsApp (perfil maria-maria) e custo por conversa", () => {
    const raw: MetaInsightRow = {
      ...base,
      actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "8" }],
    };
    const row = metaInsightToAdRow(raw, "maria-maria");
    expect(row.conversations).toBe(8);
    expect(row.results).toBe(8);
    expect(row.purchases).toBe(0);
    expect(row.costPerConversation).toBe(12.5);
  });

  it("campos ausentes viram 0 e não quebram", () => {
    const row = metaInsightToAdRow({ date_start: "2026-07-02", date_stop: "2026-07-02" }, "sales");
    expect(row.spend).toBe(0);
    expect(row.roas).toBe(0);
    expect(row.campaignName).toBe("");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- meta-insights-map`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `src/lib/meta/insights-map.ts`:

```ts
import type { AdRow } from "../csv/types";
import type { DashboardProfile } from "../server/clients";

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsightRow {
  date_start: string;
  date_stop: string;
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}

// Campos pedidos à Graph API (nível de anúncio, time_increment=1).
export const META_INSIGHT_FIELDS = [
  "campaign_name",
  "adset_name",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
];

// Tipos de ação que contam como Compra (pixel padrão do Aki Sushi).
export const PURCHASE_ACTIONS = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];
// Conversa iniciada por mensagem (WhatsApp — Maria Maria).
export const WHATSAPP_CONVERSATION_ACTION = "onsite_conversion.messaging_conversation_started_7d";

export function resultKindForProfile(profile: DashboardProfile): "purchases" | "conversations" {
  return profile === "leads" || profile === "maria-maria" ? "conversations" : "purchases";
}

function num(v?: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function sumActions(list: MetaAction[] | undefined, types: string[]): number {
  if (!list) return 0;
  return list.reduce((acc, a) => (types.includes(a.action_type) ? acc + num(a.value) : acc), 0);
}

export function metaInsightToAdRow(raw: MetaInsightRow, profile: DashboardProfile): AdRow {
  const spend = num(raw.spend);
  const purchases = sumActions(raw.actions, PURCHASE_ACTIONS);
  const conversionValue = sumActions(raw.action_values, PURCHASE_ACTIONS);
  const conversations = sumActions(raw.actions, [WHATSAPP_CONVERSATION_ACTION]);
  const kind = resultKindForProfile(profile);
  const results = kind === "conversations" ? conversations : purchases;

  // rawData preserva os campos escalares originais para a tela (nada se perde).
  const rawData: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") rawData[k] = v;
  }
  rawData["Origem"] = "Meta API";

  return {
    campaignName: raw.campaign_name ?? "",
    adSetName: raw.adset_name ?? "",
    adName: raw.ad_name ?? "",
    date: raw.date_start,
    endDate: raw.date_stop,
    objective: "",
    delivery: "",
    budget: 0,
    budgetType: "",
    attribution: "",
    spend,
    impressions: num(raw.impressions),
    reach: num(raw.reach),
    frequency: num(raw.frequency),
    clicks: num(raw.clicks),
    ctr: num(raw.ctr),
    cpc: num(raw.cpc),
    cpm: num(raw.cpm),
    results,
    resultIndicator: kind === "conversations" ? "Conversas iniciadas" : "Compras",
    resultUnit: "",
    costPerResult: results > 0 ? spend / results : 0,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
    conversionValue,
    averageConversionValue: purchases > 0 ? conversionValue / purchases : 0,
    roas: spend > 0 ? conversionValue / spend : 0,
    conversations,
    costPerConversation: conversations > 0 ? spend / conversations : 0,
    videoPlays: 0,
    thruplays: 0,
    video25: 0,
    video50: 0,
    video75: 0,
    video95: 0,
    engagement: 0,
    reactions: 0,
    comments: 0,
    shares: 0,
    viewContent: 0,
    addToCart: 0,
    initiateCheckout: 0,
    ctrTodos: 0,
    rawData,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- meta-insights-map`
Expected: PASS (3 blocos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/insights-map.ts test/meta-insights-map.test.ts
git commit -m "feat: mapeamento puro Graph API -> AdRow (compra/conversa por perfil)"
```

---

### Task 3: Token no env + delete por intervalo

**Files:**
- Modify: `src/lib/server/env.ts`
- Modify: `src/lib/server/insights.ts`
- Test: `test/insights.test.ts`

**Interfaces:**
- Consumes: `upsertInsights`, `getInsights` (já existem).
- Produces: `deleteInsightsInRange(db, clientId, start, end): Promise<number>` (nº de linhas removidas); `WorkerEnv.META_ACCESS_TOKEN?`, `WorkerEnv.META_API_VERSION?`.

- [ ] **Step 1: Adicionar o token ao env (sem teste próprio — tipagem)**

Em `src/lib/server/env.ts`, dentro de `interface WorkerEnv`, após `AUTH_PASSWORD?: string;`:

```ts
  // Integração Meta API: token de System User (produção via wrangler secret,
  // dev via .dev.vars). Versão opcional (default v21.0). Nunca no código.
  META_ACCESS_TOKEN?: string;
  META_API_VERSION?: string;
```

- [ ] **Step 2: Escrever o teste que falha (delete por intervalo)**

Adicionar ao `describe("insights repo", ...)` em `test/insights.test.ts` (o helper `makeRow` já existe no arquivo). Incluir o import no topo:

```ts
import { deleteInsightsInRange } from "../src/lib/server/insights";
```

E o caso:

```ts
it("apaga somente as linhas do intervalo (delete-and-replace)", async () => {
  await upsertInsights(
    env.DB,
    clientId,
    [
      makeRow({ date: "2026-06-15" }),
      makeRow({ date: "2026-07-01" }),
      makeRow({ date: "2026-07-20" }),
    ],
    "csv",
  );
  const removed = await deleteInsightsInRange(env.DB, clientId, "2026-07-01", "2026-07-31");
  expect(removed).toBe(2);
  const rest = await getInsights(env.DB, clientId);
  expect(rest.map((r) => r.date)).toEqual(["2026-06-15"]);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm test -- insights`
Expected: FAIL — `deleteInsightsInRange is not a function`.

- [ ] **Step 4: Implementar**

Adicionar ao final de `src/lib/server/insights.ts`:

```ts
/** Remove as linhas de um cliente dentro de [start, end] (YYYY-MM-DD). Usado antes
 * de regravar um período com dados frescos da Meta, evitando dupla contagem. */
export async function deleteInsightsInRange(
  db: D1Database,
  clientId: number,
  start: string,
  end: string,
): Promise<number> {
  const res = await db
    .prepare("DELETE FROM ad_daily_insights WHERE client_id = ? AND date >= ? AND date <= ?")
    .bind(clientId, start, end)
    .run();
  return res.meta.changes ?? 0;
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test -- insights`
Expected: PASS (todos os casos de insights, incluindo o novo).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/env.ts src/lib/server/insights.ts test/insights.test.ts
git commit -m "feat: env META_ACCESS_TOKEN e deleteInsightsInRange (delete-and-replace)"
```

---

### Task 4: Repositório de servidor da Meta (fetch + sync + test)

**Files:**
- Create: `src/lib/server/meta.ts`
- Test: `test/meta-sync.test.ts`

**Interfaces:**
- Consumes: `metaInsightToAdRow`, `META_INSIGHT_FIELDS`, `MetaInsightRow` (Task 2); `deleteInsightsInRange`, `upsertInsights` (Task 3); `touchLastSynced` (`server/clients.ts`, já existe); `addDaysISO`, `todayInSaoPaulo` (Task 1); `getWorkerEnv` (`server/env.ts`); `Client` (`server/clients.ts`).
- Produces:
  - `interface Range { start: string; end: string }`
  - `interface MetaSyncResult { days: number; ads: number; range: Range }`
  - `type FetchInsights = (accountId: string, range: Range) => Promise<MetaInsightRow[]>`
  - `fetchMetaInsights(accountId: string, range: Range): Promise<MetaInsightRow[]>`
  - `testMetaConnection(client: Client): Promise<{ ok: true; accountName: string }>`
  - `syncClientFromMeta(db, client: Client, opts?: { days?: number; today?: string; fetchInsights?: FetchInsights }): Promise<MetaSyncResult>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/meta-sync.test.ts` (injeta um `fetchInsights` falso — nenhum token/rede real):

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient, getClientBySlug } from "../src/lib/server/clients";
import { getInsights } from "../src/lib/server/insights";
import { syncClientFromMeta } from "../src/lib/server/meta";
import type { MetaInsightRow } from "../src/lib/meta/insights-map";

const fakeRows: MetaInsightRow[] = [
  {
    date_start: "2026-07-10",
    date_stop: "2026-07-10",
    campaign_name: "C",
    adset_name: "A",
    ad_name: "Ad1",
    spend: "50",
    impressions: "500",
    clicks: "10",
    actions: [{ action_type: "purchase", value: "2" }],
    action_values: [{ action_type: "purchase", value: "300" }],
  },
];

async function makeClient() {
  const c = await createClient(env.DB, {
    name: `C${Date.now()}${Math.random()}`,
    slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    dashboardProfile: "sales",
    metaAdAccountId: "act_123",
  });
  return (await getClientBySlug(env.DB, c.slug))!;
}

describe("syncClientFromMeta", () => {
  let client: Awaited<ReturnType<typeof makeClient>>;
  beforeEach(async () => {
    client = await makeClient();
  });

  it("busca, grava com source meta_api e retorna contagem", async () => {
    const result = await syncClientFromMeta(env.DB, client, {
      today: "2026-07-30",
      fetchInsights: async () => fakeRows,
    });
    expect(result.range).toEqual({ start: "2026-07-01", end: "2026-07-30" });
    expect(result.ads).toBe(1);
    expect(result.days).toBe(1);
    const rows = await getInsights(env.DB, client.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].purchases).toBe(2);
    expect(rows[0].conversionValue).toBe(300);
  });

  it("sincronizar 2× o mesmo período não duplica", async () => {
    const opts = { today: "2026-07-30", fetchInsights: async () => fakeRows };
    await syncClientFromMeta(env.DB, client, opts);
    await syncClientFromMeta(env.DB, client, opts);
    expect(await getInsights(env.DB, client.id)).toHaveLength(1);
  });

  it("apaga dados antigos do período mesmo que a Meta não retorne aquele anúncio", async () => {
    await syncClientFromMeta(env.DB, client, { today: "2026-07-30", fetchInsights: async () => fakeRows });
    // Meta agora retorna vazio para o mesmo período => período fica limpo
    await syncClientFromMeta(env.DB, client, { today: "2026-07-30", fetchInsights: async () => [] });
    expect(await getInsights(env.DB, client.id)).toHaveLength(0);
  });

  it("sem ID de conta, erro claro", async () => {
    const noAcct = { ...client, metaAdAccountId: null };
    await expect(
      syncClientFromMeta(env.DB, noAcct, { today: "2026-07-30", fetchInsights: async () => [] }),
    ).rejects.toThrow(/conta de anúncios/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- meta-sync`
Expected: FAIL — `src/lib/server/meta.ts` inexistente.

- [ ] **Step 3: Implementar**

Criar `src/lib/server/meta.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import type { Client } from "./clients";
import { touchLastSynced } from "./clients";
import { deleteInsightsInRange, upsertInsights } from "./insights";
import { getWorkerEnv } from "./env";
import { addDaysISO, todayInSaoPaulo } from "../dates";
import {
  META_INSIGHT_FIELDS,
  metaInsightToAdRow,
  type MetaInsightRow,
} from "../meta/insights-map";

export interface Range {
  start: string;
  end: string;
}
export interface MetaSyncResult {
  days: number;
  ads: number;
  range: Range;
}
export type FetchInsights = (accountId: string, range: Range) => Promise<MetaInsightRow[]>;

const GRAPH = "https://graph.facebook.com";

function normalizeAccountId(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

interface GraphError {
  error?: { message?: string };
}

/** Busca real na Graph API (nível de anúncio, dia a dia), com paginação. */
export const fetchMetaInsights: FetchInsights = async (accountId, range) => {
  const env = await getWorkerEnv();
  const token = env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Token da Meta não configurado. Defina META_ACCESS_TOKEN.");
  const version = env.META_API_VERSION || "v21.0";
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    fields: META_INSIGHT_FIELDS.join(","),
    time_range: JSON.stringify({ since: range.start, until: range.end }),
    limit: "500",
    access_token: token,
  });
  let url = `${GRAPH}/${version}/${normalizeAccountId(accountId)}/insights?${params.toString()}`;
  const out: MetaInsightRow[] = [];
  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as GraphError & {
      data?: MetaInsightRow[];
      paging?: { next?: string };
    };
    if (json.error) throw new Error(`Meta: ${json.error.message ?? "erro desconhecido"}`);
    if (json.data) out.push(...json.data);
    url = json.paging?.next ?? "";
  }
  return out;
};

/** Chamada leve para validar token + acesso à conta antes de sincronizar. */
export async function testMetaConnection(client: Client): Promise<{ ok: true; accountName: string }> {
  const env = await getWorkerEnv();
  const token = env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Token da Meta não configurado. Defina META_ACCESS_TOKEN.");
  if (!client.metaAdAccountId) throw new Error("Configure o ID da conta de anúncios antes de testar.");
  const version = env.META_API_VERSION || "v21.0";
  const acct = normalizeAccountId(client.metaAdAccountId);
  const res = await fetch(
    `${GRAPH}/${version}/${acct}?fields=name&access_token=${encodeURIComponent(token)}`,
  );
  const json = (await res.json()) as GraphError & { name?: string };
  if (json.error) throw new Error(`Meta: ${json.error.message ?? "sem acesso à conta"}`);
  return { ok: true, accountName: json.name ?? acct };
}

/** Sincroniza a janela móvel: busca, apaga o período e regrava (source meta_api). */
export async function syncClientFromMeta(
  db: D1Database,
  client: Client,
  opts?: { days?: number; today?: string; fetchInsights?: FetchInsights },
): Promise<MetaSyncResult> {
  if (!client.metaAdAccountId) {
    throw new Error("Configure o ID da conta de anúncios antes de sincronizar.");
  }
  const days = opts?.days ?? 30;
  const end = opts?.today ?? todayInSaoPaulo();
  const start = addDaysISO(end, -(days - 1));
  const range: Range = { start, end };
  const fetchInsights = opts?.fetchInsights ?? fetchMetaInsights;

  const raw = await fetchInsights(client.metaAdAccountId, range);
  const rows = raw.map((r) => metaInsightToAdRow(r, client.dashboardProfile));

  await deleteInsightsInRange(db, client.id, start, end);
  await upsertInsights(db, client.id, rows, "meta_api");
  await touchLastSynced(db, client.id);

  const distinctDays = new Set(rows.map((r) => r.date)).size;
  return { days: distinctDays, ads: rows.length, range };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- meta-sync`
Expected: PASS (4 casos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/meta.ts test/meta-sync.test.ts
git commit -m "feat: repositorio Meta (fetch Graph API + sync delete-and-replace + testar conexao)"
```

---

### Task 5: Server functions (sincronizar / testar / salvar conta)

**Files:**
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `syncClientFromMeta`, `testMetaConnection` (Task 4); `getClientBySlug`, `updateClient` (`server/clients.ts`).
- Produces (server functions): `syncClientMeta({ slug, days? })`, `testClientMetaConnection({ slug })`, `saveClientMetaAccountId({ clientId, accountId })`.

- [ ] **Step 1: Registrar o módulo em `serverDeps()`**

Em `src/lib/api.ts`, no array de `Promise.all` do `serverDeps` (após `strategicMemory` / `import("./server/strategic-memory")`), adicionar a variável e o import:

Na desestruturação:
```ts
    strategicMemory,
    meta,
```
No array de imports:
```ts
    import("./server/strategic-memory"),
    import("./server/meta"),
```
No objeto retornado, após `...strategicMemory,`:
```ts
    ...meta,
```

- [ ] **Step 2: Adicionar as três server functions**

Em `src/lib/api.ts`, logo após o bloco `saveClientDecisionObservation` (fim da seção Fase 4, antes do `import { getCookie, ... }`), inserir:

```ts
// --- Meta API: sincronização de métricas sob demanda ---

export const saveClientMetaAccountId = createServerFn({ method: "POST" })
  .inputValidator((input: { clientId: number; accountId: string }) => input)
  .handler(async ({ data }): Promise<Client> => {
    const { db, updateClient } = await serverDeps();
    const accountId = data.accountId.trim();
    return updateClient(db, data.clientId, { metaAdAccountId: accountId || null });
  });

export const testClientMetaConnection = createServerFn({ method: "POST" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<{ ok: true; accountName: string }> => {
    const { db, getClientBySlug, testMetaConnection } = await serverDeps();
    const client = await getClientBySlug(db, slug);
    if (!client) throw new Error("Cliente não encontrado.");
    return testMetaConnection(client);
  });

export const syncClientMeta = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; days?: number }) => input)
  .handler(async ({ data }): Promise<{ days: number; ads: number; start: string; end: string }> => {
    const { db, getClientBySlug, syncClientFromMeta } = await serverDeps();
    const client = await getClientBySlug(db, data.slug);
    if (!client) throw new Error("Cliente não encontrado.");
    const result = await syncClientFromMeta(db, client, { days: data.days });
    return { days: result.days, ads: result.ads, start: result.range.start, end: result.range.end };
  });
```

- [ ] **Step 3: Verificar tipos e lint (server functions não têm teste de runtime próprio; a lógica está coberta na Task 4)**

Run: `npm run lint`
Expected: sem erros. (Se `npx tsc --noEmit` estiver disponível, rode-o também; esperado: sem erros de tipo.)

- [ ] **Step 4: Rodar a suíte completa (nada quebrou)**

Run: `npm test`
Expected: PASS — 81 + novos testes das Tasks 1–4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: server functions syncClientMeta, testClientMetaConnection, saveClientMetaAccountId"
```

---

### Task 6: Painel de UI (configurar conta + testar + sincronizar)

**Files:**
- Create: `src/components/dashboard/MetaSyncPanel.tsx`

**Interfaces:**
- Consumes: `syncClientMeta`, `testClientMetaConnection`, `saveClientMetaAccountId` (Task 5); `Client` (`@/lib/server/clients`); componentes `Button`, `Input`, `Label` (`@/components/ui/*`); `useRouter` (`@tanstack/react-router`).
- Produces: `export function MetaSyncPanel({ client }: { client: Client }): JSX.Element`.

- [ ] **Step 1: Implementar o componente**

Criar `src/components/dashboard/MetaSyncPanel.tsx`:

```tsx
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { RefreshCw, PlugZap, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/lib/server/clients";
import { saveClientMetaAccountId, testClientMetaConnection, syncClientMeta } from "@/lib/api";

type Feedback = { kind: "ok" | "err"; text: string } | null;

export function MetaSyncPanel({ client }: { client: Client }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(client.metaAdAccountId ?? "");
  const [busy, setBusy] = useState<null | "save" | "test" | "sync">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function run<T>(kind: "save" | "test" | "sync", fn: () => Promise<T>, ok: (r: T) => string) {
    setBusy(kind);
    setFeedback(null);
    try {
      const r = await fn();
      setFeedback({ kind: "ok", text: ok(r) });
      await router.invalidate();
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Erro inesperado." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Meta Ads (atualização direta)</h2>
        <p className="text-sm text-muted-foreground">
          Busque as métricas dos últimos 30 dias direto da Meta. O CSV abaixo continua disponível
          como alternativa de emergência.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meta-account" className="text-xs uppercase tracking-wider text-muted-foreground">
          ID da conta de anúncios
        </Label>
        <div className="flex gap-2">
          <Input
            id="meta-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="act_1234567890"
          />
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              run("save", () => saveClientMetaAccountId({ data: { clientId: client.id, accountId } }), () => "ID salvo.")
            }
          >
            {busy === "save" ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="gap-2"
          disabled={busy !== null}
          onClick={() =>
            run("test", () => testClientMetaConnection({ data: client.slug }), (r) => `Conexão OK: ${r.accountName}`)
          }
        >
          <PlugZap className="w-4 h-4" /> {busy === "test" ? "Testando..." : "Testar conexão"}
        </Button>
        <Button
          className="gap-2"
          disabled={busy !== null}
          onClick={() =>
            run(
              "sync",
              () => syncClientMeta({ data: { slug: client.slug } }),
              (r) => `Pronto: ${r.days} dias / ${r.ads} anúncios (${r.start} a ${r.end}).`,
            )
          }
        >
          <RefreshCw className={`w-4 h-4 ${busy === "sync" ? "animate-spin" : ""}`} />
          {busy === "sync" ? "Atualizando..." : "Atualizar via Meta"}
        </Button>
      </div>

      {client.lastSyncedAt && (
        <p className="text-xs text-muted-foreground">
          Última atualização: {client.lastSyncedAt} (UTC)
        </p>
      )}

      {feedback && (
        <p
          className={`flex items-center gap-2 text-sm ${
            feedback.kind === "ok" ? "text-emerald-400" : "text-destructive"
          }`}
        >
          {feedback.kind === "ok" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {feedback.text}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar lint/tipos**

Run: `npm run lint`
Expected: sem erros no novo arquivo.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/MetaSyncPanel.tsx
git commit -m "feat: MetaSyncPanel (configurar conta, testar conexao, atualizar via Meta)"
```

---

### Task 7: Montar na página de upload + atualizar docs

**Files:**
- Modify: `src/routes/upload.$clientSlug.tsx`
- Modify: `docs/dashboard-de-ouro/roadmap.md`
- Modify: `docs/dashboard-de-ouro/decisions.md`

**Interfaces:**
- Consumes: `MetaSyncPanel` (Task 6). O `loader` da rota já devolve `client` (com `metaAdAccountId` e `lastSyncedAt`).

- [ ] **Step 1: Importar e montar o painel**

Em `src/routes/upload.$clientSlug.tsx`, adicionar o import (junto aos demais imports de componentes):

```ts
import { MetaSyncPanel } from "@/components/dashboard/MetaSyncPanel";
```

E montar o painel logo após o bloco do cabeçalho (`</div>` que fecha o `<div>` do `<h1>Atualizar dados …</h1>`) e antes do `<div className="space-y-4">` do "CSV do Meta Ads":

```tsx
        <MetaSyncPanel client={client} />
```

- [ ] **Step 2: Verificar no app (manual, localhost)**

Run: `npm run dev`
Abrir `/upload/<slug>` de um cliente. Esperado: o painel "Meta Ads (atualização direta)" aparece acima do CSV, com campo de ID, "Testar conexão" e "Atualizar via Meta". (Sem `META_ACCESS_TOKEN` em `.dev.vars`, "Testar conexão" deve responder erro claro de token — comportamento correto.)

- [ ] **Step 3: Atualizar o roadmap**

Em `docs/dashboard-de-ouro/roadmap.md`, na linha da Meta API transversal, marcar como concluída a primeira fatia:

```markdown
- [x] Meta API — sincronização sob demanda (botão "Atualizar via Meta", janela móvel de 30 dias, delete-and-replace, eventos padrão Compra/Aki e Conversa WhatsApp/Maria). Clientes: Maria Maria e Aki Sushi. CSV mantido como fallback. (2026-07-12, branch `v1.6-meta-API`)
```

- [ ] **Step 4: Registrar a decisão**

Adicionar em `docs/dashboard-de-ouro/decisions.md`:

```markdown
## Meta API — sincronização sob demanda (2026-07-12)
- Token único de System User do BM (app novo, dedicado), somente leitura, em segredo (`.dev.vars` / `wrangler secret`).
- Janela móvel de 30 dias por clique; o período sincronizado "pertence à API" (delete-and-replace) para não duplicar quando o nome do anúncio diverge do CSV.
- Eventos fixos por perfil: Compra (`purchase`/`omni_purchase`) para vendas; conversa iniciada (`messaging_conversation_started_7d`) para WhatsApp/Maria. Tela de escolher evento fica para quando surgir conversão personalizada.
- CSV permanece como fallback de emergência; dados comerciais manuais (salão) intocados.
```

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS — todos verdes.

- [ ] **Step 6: Commit**

```bash
git add src/routes/upload.$clientSlug.tsx docs/dashboard-de-ouro/roadmap.md docs/dashboard-de-ouro/decisions.md
git commit -m "feat: painel Meta na pagina de upload + docs (roadmap/decisions)"
```

---

## Pré-requisitos do gestor (fora do código, para validar de ponta a ponta)

1. Criar app novo na Meta for Developers (dedicado ao Dashboard).
2. Criar System User no Business Manager e gerar token com `ads_read` sobre as contas do Maria Maria e Aki Sushi.
3. Fornecer os dois `act_...` (IDs das contas) para preencher no painel.
4. Colocar o token em `.dev.vars` local (`META_ACCESS_TOKEN=...`) e, quando for para produção, `wrangler secret put META_ACCESS_TOKEN`.

## Validação final (manual, após configurar o token)

- No `/upload/<slug>` do Maria Maria: preencher o ID, "Testar conexão" (deve mostrar o nome da conta), "Atualizar via Meta" (deve reportar dias/anúncios). Conferir os números de **conversas** contra o relatório do n8n. Se o número não bater, ajustar `WHATSAPP_CONVERSATION_ACTION` em `insights-map.ts` e reexecutar a Task 2.
- Repetir para o Aki Sushi (conferir **compras** e **faturamento**).
- Confirmar no dashboard que os dados aparecem e que reimportar não infla os totais.
