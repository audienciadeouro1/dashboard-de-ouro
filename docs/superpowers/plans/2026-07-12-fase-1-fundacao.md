# Fase 1 — Fundação de dados: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a Fase 1 do roadmap: motor de métricas testado (compartilhado + servidor), decomposição do `dashboard.tsx`, seletor de datas ligado ao servidor e qualidade de dados v1 (selo + detalhes).

**Architecture:** As fórmulas puras já existem em `src/lib/csv/aggregate.ts`; extraímos para `src/lib/metrics/formulas.ts` (fonte única, sem banco), criamos `src/lib/server/metrics.ts` (banco → fórmulas no servidor) e `src/lib/server/quality.ts` (verificações explicáveis). O `dashboard.tsx` (~2.774 linhas) é decomposto em componentes por aba em `src/components/dashboard/` sem mudança visual. O seletor de datas passa a alimentar `fetchClientData` via search params da rota.

**Tech Stack:** TanStack Start (React 19), Cloudflare Workers + D1, vitest-pool-workers, shadcn/ui + Tailwind v4.

## Global Constraints

- **REGRA Nº 1 — comportamento preservado:** os números exibidos hoje são o gabarito. Divisão por zero retorna `0` (comportamento atual — formatters da UI cuidam da exibição). Nenhuma fórmula muda de resultado. Cruzamento de CSVs (Maria Maria) e análise avulsa intactos.
- Código de banco **somente** em `src/lib/server/`, importado dinamicamente pelos handlers de `src/lib/api.ts` (nunca estático no cliente).
- Testes: `npm test` (vitest-pool-workers). Baseline de 13 testes deve continuar verde em toda tarefa.
- UI e mensagens de erro em PT-BR. Identidade: fundo escuro + dourado (`GOLD`/`WARNING`/`DANGER` já definidos).
- Datas TEXT `YYYY-MM-DD`, fuso America/Sao_Paulo. Valores em BRL.
- **NUNCA** fazer deploy. Cada checkpoint é testado pelo Thallys em localhost (`npm run dev`).
- Commits frequentes, mensagens em PT-BR no padrão do repo (`feat:`/`fix:`/`refactor:`/`docs:`).
- Sem migrações de banco nesta fase.

## Checkpoints do Thallys

O plano tem 4 checkpoints de teste manual (fim das Tasks 3, 7, 8 e 10). Ao chegar num checkpoint: parar, avisar o Thallys, esperar aprovação antes de seguir.

---

### Task 1: Módulo de fórmulas puras (`src/lib/metrics/formulas.ts`)

**Files:**
- Create: `src/lib/metrics/formulas.ts`
- Test: `test/formulas.test.ts`

**Interfaces:**
- Produces: `safeDiv(num: number, den: number): number` · `ctr(clicks, impressions)` · `cpc(spend, clicks)` · `cpm(spend, impressions)` · `roas(conversionValue, spend)` · `cpa(spend, purchases)` · `costPerResult(spend, results)` · `costPerConversation(spend, conversations)` · `costPerThruplay(spend, thruplays)` · `frequency(impressions, reach)` · `ticketMedio(conversionValue, purchases, fallback?)` — todos `(…): number`, retornam `0` quando o denominador é `0` (idêntico ao comportamento atual de `aggregate.ts:100-108`).

- [ ] **Step 1: Escrever os testes que falham**

```typescript
// test/formulas.test.ts
import { describe, it, expect } from "vitest";
import {
  safeDiv, ctr, cpc, cpm, roas, cpa,
  costPerResult, costPerConversation, costPerThruplay,
  frequency, ticketMedio,
} from "../src/lib/metrics/formulas";

describe("fórmulas puras (gabarito = comportamento atual)", () => {
  it("safeDiv divide e devolve 0 com denominador 0 (nunca NaN/Infinity)", () => {
    expect(safeDiv(10, 4)).toBe(2.5);
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(0, 0)).toBe(0);
    expect(Number.isFinite(safeDiv(1, 0))).toBe(true);
  });

  it("ctr = cliques/impressões × 100", () => {
    expect(ctr(50, 1000)).toBe(5);
    expect(ctr(60, 1500)).toBe(4);
    expect(ctr(5, 0)).toBe(0);
  });

  it("cpc = investimento/cliques", () => {
    expect(cpc(150, 60)).toBe(2.5);
    expect(cpc(100, 0)).toBe(0);
  });

  it("cpm = investimento/impressões × 1000", () => {
    expect(cpm(150, 1500)).toBe(100);
    expect(cpm(10, 0)).toBe(0);
  });

  it("roas = faturamento/investimento", () => {
    expect(roas(600, 150)).toBe(4);
    expect(roas(500, 0)).toBe(0);
  });

  it("cpa = investimento/compras", () => {
    expect(cpa(150, 4)).toBe(37.5);
    expect(cpa(150, 0)).toBe(0);
  });

  it("custo por resultado / conversa / thruplay", () => {
    expect(costPerResult(150, 14)).toBeCloseTo(10.714285714285714, 12);
    expect(costPerConversation(150, 10)).toBe(15);
    expect(costPerThruplay(90, 30)).toBe(3);
    expect(costPerResult(150, 0)).toBe(0);
    expect(costPerConversation(150, 0)).toBe(0);
    expect(costPerThruplay(90, 0)).toBe(0);
  });

  it("frequency = impressões/alcance", () => {
    expect(frequency(1500, 1200)).toBe(1.25);
    expect(frequency(1500, 0)).toBe(0);
  });

  it("ticketMedio = faturamento/compras, com fallback quando não há compras", () => {
    expect(ticketMedio(600, 4)).toBe(150);
    expect(ticketMedio(600, 0)).toBe(0);
    expect(ticketMedio(600, 0, 166.7)).toBe(166.7);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/formulas.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/metrics/formulas'`

- [ ] **Step 3: Implementar o módulo**

```typescript
// src/lib/metrics/formulas.ts
/**
 * Fórmulas puras de métricas de tráfego — fonte única da verdade.
 * REGRA: divisão por zero retorna 0 (comportamento histórico do sistema;
 * os formatters da UI cuidam da exibição). Nunca NaN/Infinity.
 * Extraído de src/lib/csv/aggregate.ts sem mudança de resultado.
 */

/** Divisão segura: retorna 0 se o denominador não for positivo. */
export const safeDiv = (num: number, den: number): number => (den > 0 ? num / den : 0);

/** CTR em % = cliques no link / impressões × 100 */
export const ctr = (clicks: number, impressions: number): number =>
  safeDiv(clicks, impressions) * 100;

/** CPC em BRL = investimento / cliques no link */
export const cpc = (spend: number, clicks: number): number => safeDiv(spend, clicks);

/** CPM em BRL = investimento / impressões × 1000 */
export const cpm = (spend: number, impressions: number): number =>
  safeDiv(spend, impressions) * 1000;

/** ROAS = valor de conversão / investimento */
export const roas = (conversionValue: number, spend: number): number =>
  safeDiv(conversionValue, spend);

/** CPA em BRL = investimento / compras */
export const cpa = (spend: number, purchases: number): number => safeDiv(spend, purchases);

/** Custo por resultado em BRL */
export const costPerResult = (spend: number, results: number): number =>
  safeDiv(spend, results);

/** Custo por conversa iniciada em BRL */
export const costPerConversation = (spend: number, conversations: number): number =>
  safeDiv(spend, conversations);

/** Custo por ThruPlay em BRL */
export const costPerThruplay = (spend: number, thruplays: number): number =>
  safeDiv(spend, thruplays);

/** Frequência = impressões / alcance */
export const frequency = (impressions: number, reach: number): number =>
  safeDiv(impressions, reach);

/**
 * Ticket médio = valor de conversão / compras.
 * Sem compras, usa o fallback (maior "valor médio de conversão" informado pela Meta), como hoje.
 */
export const ticketMedio = (
  conversionValue: number,
  purchases: number,
  fallback = 0,
): number => (purchases > 0 ? conversionValue / purchases : fallback);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/formulas.test.ts`
Expected: PASS (9 testes)

- [ ] **Step 5: Suíte completa + commit**

Run: `npm test` — Expected: 13 baseline + 9 novos, todos verdes.

```bash
git add src/lib/metrics/formulas.ts test/formulas.test.ts
git commit -m "feat: modulo de formulas puras de metricas com testes de precisao"
```

---

### Task 2: `aggregate.ts` passa a usar as fórmulas (golden-master)

**Files:**
- Modify: `src/lib/csv/aggregate.ts:99-113` (função `aggregate`) e `src/lib/csv/aggregate.ts:205-217` (função `totals`) e `src/lib/csv/aggregate.ts:292-298` (função `timeSeries`)
- Test: `test/aggregate.test.ts`

**Interfaces:**
- Consumes: fórmulas da Task 1.
- Produces: `aggregate(rows, dimension)`, `totals(rows): Totals`, `timeSeries(rows)` — assinaturas e resultados **inalterados** (consumidos pelo `dashboard.tsx` hoje).

- [ ] **Step 1: Escrever o teste golden-master ANTES de refatorar (deve passar já com o código atual)**

```typescript
// test/aggregate.test.ts
import { describe, it, expect } from "vitest";
import { aggregate, totals, timeSeries } from "../src/lib/csv/aggregate";
import type { AdRow } from "../src/lib/csv/types";

function makeRow(overrides: Partial<AdRow> = {}): AdRow {
  return {
    campaignName: "Campanha A", adSetName: "Conjunto 1", adName: "Anúncio X",
    date: "2026-07-01", endDate: "2026-07-01", objective: "", delivery: "",
    budget: 0, budgetType: "", attribution: "",
    spend: 100, impressions: 1000, reach: 800, frequency: 0,
    clicks: 50, ctr: 0, cpc: 0, cpm: 0,
    results: 10, resultIndicator: "", resultUnit: "", costPerResult: 0,
    purchases: 3, cpa: 0, conversionValue: 500, averageConversionValue: 0, roas: 0,
    conversations: 8, costPerConversation: 0,
    videoPlays: 0, thruplays: 0, video25: 0, video50: 0, video75: 0, video95: 0,
    engagement: 0, reactions: 0, comments: 0, shares: 0, ctrTodos: 0,
    rawData: {},
    ...overrides,
  };
}

const ROWS: AdRow[] = [
  makeRow(),
  makeRow({
    adName: "Anúncio Y", date: "2026-07-02",
    spend: 50, impressions: 500, reach: 400, clicks: 10,
    results: 4, purchases: 1, conversionValue: 100, conversations: 2,
  }),
];

describe("golden-master: totals/aggregate/timeSeries preservam os números atuais", () => {
  it("totals soma e deriva exatamente como hoje", () => {
    const t = totals(ROWS);
    expect(t.spend).toBe(150);
    expect(t.impressions).toBe(1500);
    expect(t.clicks).toBe(60);
    expect(t.reach).toBe(1200);
    expect(t.purchases).toBe(4);
    expect(t.conversionValue).toBe(600);
    expect(t.conversations).toBe(10);
    expect(t.results).toBe(14);
    expect(t.ctr).toBe(4);            // 60/1500*100
    expect(t.cpc).toBe(2.5);          // 150/60
    expect(t.cpm).toBe(100);          // 150/1500*1000
    expect(t.roas).toBe(4);           // 600/150
    expect(t.cpa).toBe(37.5);         // 150/4
    expect(t.costPerResult).toBeCloseTo(10.714285714285714, 12);
    expect(t.costPerConversation).toBe(15);
    expect(t.frequency).toBe(1.25);   // 1500/1200
    expect(t.ticketMedio).toBe(150);  // 600/4
  });

  it("totals de lista vazia devolve zeros (sem NaN)", () => {
    const t = totals([]);
    for (const [k, v] of Object.entries(t)) {
      expect(Number.isFinite(v as number), `campo ${k}`).toBe(true);
    }
    expect(t.spend).toBe(0);
    expect(t.ctr).toBe(0);
    expect(t.ticketMedio).toBe(0);
  });

  it("ticketMedio usa fallback averageConversionValue quando não há compras", () => {
    const t = totals([makeRow({ purchases: 0, conversionValue: 0, averageConversionValue: 87.5 })]);
    expect(t.ticketMedio).toBe(87.5);
  });

  it("aggregate por campanha deriva as mesmas métricas", () => {
    const [a] = aggregate(ROWS, "campaignName");
    expect(a.key).toBe("Campanha A");
    expect(a.spend).toBe(150);
    expect(a.ctr).toBe(4);
    expect(a.cpc).toBe(2.5);
    expect(a.cpm).toBe(100);
    expect(a.roas).toBe(4);
    expect(a.cpa).toBe(37.5);
    expect(a.costPerConversation).toBe(15);
    expect(a.frequency).toBe(1.25);
    expect(a.rows).toBe(2);
  });

  it("timeSeries ordena por data e deriva cpa/custo-conversa por dia", () => {
    const s = timeSeries(ROWS);
    expect(s.map((d) => d.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(s[0].cpa).toBe(10);                 // 100/10 (cpa da série usa results)
    expect(s[1].costPerConversation).toBe(25); // 50/2
  });
});
```

- [ ] **Step 2: Rodar — deve PASSAR já (é o gabarito do código atual)**

Run: `npx vitest run test/aggregate.test.ts`
Expected: PASS. **Se falhar, o teste está errado — corrigir o teste, nunca o `aggregate.ts`.**

- [ ] **Step 3: Refatorar `aggregate.ts` para usar as fórmulas**

No topo do arquivo: `import * as f from "../metrics/formulas";`

Em `aggregate()` (bloco atual nas linhas ~99-113), substituir os cálculos derivados por:

```typescript
  for (const a of map.values()) {
    a.ctr = f.ctr(a.clicks, a.impressions);
    a.cpc = f.cpc(a.spend, a.clicks);
    a.cpm = f.cpm(a.spend, a.impressions);
    a.roas = f.roas(a.conversionValue, a.spend);
    a.cpa = f.cpa(a.spend, a.purchases);
    a.costPerResult = f.costPerResult(a.spend, a.results);
    a.costPerConversation = f.costPerConversation(a.spend, a.conversations);
    a.costPerThruplay = f.costPerThruplay(a.spend, a.thruplays);
    a.frequency = f.frequency(a.impressions, a.reach);
  }
```

(Obs.: o `if (a.purchases > 0) { a.conversionValue = a.conversionValue || 0; }` atual é inócuo — pode ser removido nesta refatoração.)

Em `totals()` (linhas ~205-217), substituir por:

```typescript
  t.ctr = f.ctr(t.clicks, t.impressions);
  t.cpc = f.cpc(t.spend, t.clicks);
  t.cpm = f.cpm(t.spend, t.impressions);
  t.roas = f.roas(t.conversionValue, t.spend);
  t.cpa = f.cpa(t.spend, t.purchases);
  t.costPerResult = f.costPerResult(t.spend, t.results);
  t.costPerConversation = f.costPerConversation(t.spend, t.conversations);
  t.costPerThruplay = f.costPerThruplay(t.spend, t.thruplays);
  t.frequency = f.frequency(t.impressions, t.reach);
  t.ticketMedio = f.ticketMedio(
    t.conversionValue,
    t.purchases,
    rows.reduce((max, r) => Math.max(max, r.averageConversionValue || 0), 0),
  );
```

Em `timeSeries()` (linhas ~292-298), no `.map`:

```typescript
    .map((d) => ({
      ...d,
      cpa: f.costPerResult(d.spend, d.results),
      costPerConversation: f.costPerConversation(d.spend, d.conversations),
    }))
```

(Obs.: o `cpa` da série sempre foi `spend/results` — manter exatamente assim.)

- [ ] **Step 4: Rodar tudo e ver verde**

Run: `npm test` — Expected: todos passam (o golden-master prova que nada mudou).
Run: `npm run build` — Expected: build sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv/aggregate.ts test/aggregate.test.ts
git commit -m "refactor: aggregate.ts consome o modulo de formulas (golden-master garante zero mudanca)"
```

---

### Task 3: Métricas no servidor (`src/lib/server/metrics.ts` + server function)

**Files:**
- Create: `src/lib/server/metrics.ts`
- Modify: `src/lib/api.ts` (novo server fn `fetchClientMetrics`; incluir `metrics` em `serverDeps`)
- Test: `test/metrics.test.ts`

**Interfaces:**
- Consumes: `getInsights(db, clientId, range?)` de `server/insights.ts`; `totals`/`timeSeries` de `csv/aggregate.ts`.
- Produces: `getClientTotals(db: D1Database, clientId: number, range?: { start?: string; end?: string }): Promise<Totals>` · `getClientTimeSeries(db, clientId, range?)` · server fn `fetchClientMetrics({ data: { slug, start?, end? } })` → `{ totals: Totals; series: ReturnType<typeof timeSeries> } | null`. (Consumidor imediato: testes; futuro: Fases 2-3 e endpoints para o n8n.)

- [ ] **Step 1: Teste que falha**

```typescript
// test/metrics.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import { getClientTotals, getClientTimeSeries } from "../src/lib/server/metrics";
import type { AdRow } from "../src/lib/csv/types";

function makeRow(overrides: Partial<AdRow> = {}): AdRow {
  return {
    campaignName: "Campanha A", adSetName: "Conjunto 1", adName: "Anúncio X",
    date: "2026-07-01", endDate: "2026-07-01", objective: "", delivery: "",
    budget: 0, budgetType: "", attribution: "",
    spend: 100, impressions: 1000, reach: 800, frequency: 0,
    clicks: 50, ctr: 0, cpc: 0, cpm: 0,
    results: 10, resultIndicator: "", resultUnit: "", costPerResult: 0,
    purchases: 3, cpa: 0, conversionValue: 500, averageConversionValue: 0, roas: 0,
    conversations: 8, costPerConversation: 0,
    videoPlays: 0, thruplays: 0, video25: 0, video50: 0, video75: 0, video95: 0,
    engagement: 0, reactions: 0, comments: 0, shares: 0, ctrTodos: 0,
    rawData: {},
    ...overrides,
  };
}

describe("metrics no servidor", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `M${Date.now()}${Math.random()}`,
      slug: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
    await upsertInsights(
      env.DB, clientId,
      [
        makeRow(),
        makeRow({ adName: "Anúncio Y", date: "2026-07-02", spend: 50, impressions: 500, reach: 400, clicks: 10, results: 4, purchases: 1, conversionValue: 100, conversations: 2 }),
      ],
      "csv",
    );
  });

  it("calcula totais do banco iguais ao golden-master", async () => {
    const t = await getClientTotals(env.DB, clientId);
    expect(t.spend).toBe(150);
    expect(t.ctr).toBe(4);
    expect(t.cpc).toBe(2.5);
    expect(t.roas).toBe(4);
    expect(t.ticketMedio).toBe(150);
  });

  it("respeita o filtro de período", async () => {
    const t = await getClientTotals(env.DB, clientId, { start: "2026-07-02", end: "2026-07-02" });
    expect(t.spend).toBe(50);
    expect(t.cpc).toBe(5); // 50/10
  });

  it("período sem dados devolve zeros, nunca NaN", async () => {
    const t = await getClientTotals(env.DB, clientId, { start: "2030-01-01", end: "2030-01-31" });
    expect(t.spend).toBe(0);
    expect(Number.isFinite(t.ctr)).toBe(true);
  });

  it("série temporal do banco vem ordenada por dia", async () => {
    const s = await getClientTimeSeries(env.DB, clientId);
    expect(s.map((d) => d.date)).toEqual(["2026-07-01", "2026-07-02"]);
    expect(s[0].spend).toBe(100);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/metrics.test.ts`
Expected: FAIL — módulo `server/metrics` não existe.

- [ ] **Step 3: Implementar**

```typescript
// src/lib/server/metrics.ts
import type { D1Database } from "@cloudflare/workers-types";
import { getInsights } from "./insights";
import { totals, timeSeries, type Totals } from "../csv/aggregate";

export interface MetricsRange {
  start?: string; // YYYY-MM-DD (America/Sao_Paulo)
  end?: string;   // YYYY-MM-DD
}

/** Totais determinísticos calculados no servidor a partir do D1. */
export async function getClientTotals(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<Totals> {
  const rows = await getInsights(db, clientId, range);
  return totals(rows);
}

/** Série diária determinística calculada no servidor a partir do D1. */
export async function getClientTimeSeries(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<ReturnType<typeof timeSeries>> {
  const rows = await getInsights(db, clientId, range);
  return timeSeries(rows);
}
```

Em `src/lib/api.ts`: adicionar `import("./server/metrics")` ao `Promise.all` de `serverDeps()` (e espalhar `...metrics` no retorno, seguindo o padrão existente das linhas 7-17). Depois adicionar após `fetchClientData`:

```typescript
export const fetchClientMetrics = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; start?: string; end?: string }) => input)
  .handler(async ({ data }) => {
    const { db, getClientBySlug, getClientTotals, getClientTimeSeries } = await serverDeps();
    const client = await getClientBySlug(db, data.slug);
    if (!client) return null;
    const range = { start: data.start, end: data.end };
    const [totals, series] = await Promise.all([
      getClientTotals(db, client.id, range),
      getClientTimeSeries(db, client.id, range),
    ]);
    return { totals, series };
  });
```

- [ ] **Step 4: Rodar tudo**

Run: `npm test` — Expected: verde. Run: `npm run build` — Expected: sem erros.

- [ ] **Step 5: Commit + CHECKPOINT 1**

```bash
git add src/lib/server/metrics.ts src/lib/api.ts test/metrics.test.ts
git commit -m "feat: metricas deterministicas no servidor (getClientTotals/TimeSeries + fetchClientMetrics)"
```

**CHECKPOINT 1 (Thallys):** `npm run dev` → dashboards e análise avulsa devem estar **idênticos** a antes (nenhuma mudança visual esperada). Aguardar aprovação.

---

### Task 4: Extrair tema, configs de métricas e DateRangePicker

**Files:**
- Create: `src/components/dashboard/theme.ts` · `src/components/dashboard/metric-configs.tsx` · `src/components/dashboard/DateRangePicker.tsx`
- Modify: `src/routes/dashboard.tsx`

**Interfaces:**
- Produces: `theme.ts` exporta `GOLD, GOLD_BRIGHT, GOLD_DARK, SUCCESS, DANGER, WARNING, PALETTE` (valores idênticos aos das linhas 112-118 atuais). `metric-configs.tsx` exporta `METRIC_CONFIGS` (conteúdo idêntico às linhas 120-219). `DateRangePicker.tsx` exporta `DateRangePicker` com a MESMA assinatura atual (`{ date, setDate }`).

**Regra desta e das próximas 3 tasks:** mover código **verbatim** (recortar/colar), levando junto os imports que cada trecho usa; nada de reescrever lógica ou JSX. Os números de linha citados são do arquivo ANTES da task — localizar sempre pelo nome do símbolo. O `npm run build` acusa import faltando.

- [ ] **Step 1:** Criar `theme.ts` movendo as constantes `GOLD…PALETTE` (dashboard.tsx:112-118) com `export` em cada uma. Em `dashboard.tsx`, remover as constantes e importar de `@/components/dashboard/theme`.
- [ ] **Step 2:** Criar `metric-configs.tsx` movendo `METRIC_CONFIGS` (dashboard.tsx:120-219) com `export`, levando os imports de ícones `lucide-react`, `CanonicalKey` e formatters usados. Atualizar `dashboard.tsx` para importar.
- [ ] **Step 3:** Criar `DateRangePicker.tsx` movendo a função `DateRangePicker` (dashboard.tsx:243-313) com `export`, levando imports (`Popover`, `Button`, `CalendarComponent`, `CalendarIcon`, `format`, `ptBR`, `cn`, `useState`, `useEffect`). Atualizar `dashboard.tsx`.
- [ ] **Step 4:** Verificar: `npm run build` sem erros; `npm test` verde; `npx tsc --noEmit` (se o repo tiver script de typecheck, usar o script) sem erros novos.
- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ src/routes/dashboard.tsx
git commit -m "refactor: extrai tema, METRIC_CONFIGS e DateRangePicker do dashboard.tsx"
```

---

### Task 5: Extrair KPIs e auxiliares visuais

**Files:**
- Create: `src/components/dashboard/kpis.tsx` (com `KpiDef` + `getKpis`, hoje em dashboard.tsx:570-904) · `src/components/dashboard/shared.tsx` (com `Highlight` :1558, `EmptyChart` :1592, `MetricSelector` :1600, `RankRow` :1912, `DxList` :2413)
- Modify: `src/routes/dashboard.tsx`

**Interfaces:**
- Produces: `getKpis(...)` e `KpiDef` exportados com assinaturas idênticas às atuais; `Highlight`, `EmptyChart`, `MetricSelector`, `RankRow`, `DxList` exportados idênticos.

- [ ] **Step 1:** Mover `interface KpiDef` e `function getKpis` (verbatim) para `kpis.tsx`, com os imports que usam (tipos de `csv/types`, `Aggregated`/`Totals`, formatters, ícones, `METRIC_CONFIGS` de `./metric-configs`).
- [ ] **Step 2:** Mover `Highlight`, `EmptyChart`, `MetricSelector`, `RankRow`, `DxList` (verbatim) para `shared.tsx` com seus imports.
- [ ] **Step 3:** Atualizar imports no `dashboard.tsx`; `npm run build` + `npm test` verdes.
- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/ src/routes/dashboard.tsx
git commit -m "refactor: extrai KPIs e componentes auxiliares do dashboard.tsx"
```

---

### Task 6: Extrair as abas (um arquivo por aba)

**Files:**
- Create: `src/components/dashboard/OverviewTab.tsx` (função `OverviewTab` + `interface OverviewProps`, hoje :904-1558) · `CampaignsTab.tsx` (:1651) · `AggregatedTab.tsx` (:1791) · `AdsTab.tsx` (:1946) · `ChartsTab.tsx` (:2047) · `DiagnosisTab.tsx` (:2310) · `DataQualityTab.tsx` (:2458) · `ReportTab.tsx` (:2578)
- Modify: `src/routes/dashboard.tsx`

**Interfaces:**
- Produces: cada aba exportada com a MESMA assinatura de props atual (ex.: `CampaignsTab({ diagnosed, mode }: { diagnosed: DiagnosedCampaign[]; mode: AnalysisMode })`). `DataQualityTab` usa o hook `useDashboard` — importá-lo de `@/routes/dashboard` (export já existente) para evitar dependência circular de valores; se o build reclamar de ciclo, mover `DashboardContext`/`useDashboard` para `src/components/dashboard/context.ts` e importar nos dois lados.

- [ ] **Step 1:** Mover cada função de aba (verbatim, com seus imports — Recharts, cards, ícones, `theme`, `shared`, `kpis`, tipos) para seu arquivo. Uma aba por vez, rodando `npm run build` após cada uma para pegar import faltando cedo.
- [ ] **Step 2:** Em `dashboard.tsx`, importar as 8 abas de `@/components/dashboard/…`.
- [ ] **Step 3:** `npm run build` + `npm test` verdes.
- [ ] **Step 4:** Conferir o tamanho: `wc -l src/routes/dashboard.tsx` — Expected: bem abaixo de 700 linhas (sobra Route, layout, contexto, `DashboardContent`, `useStore`).
- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ src/routes/dashboard.tsx
git commit -m "refactor: dashboard.tsx decomposto em componentes por aba"
```

---

### Task 7: Revisão da decomposição

**Files:**
- Modify: nenhum novo (ajustes finos apenas)

- [ ] **Step 1:** `npm test` e `npm run build` verdes; navegar mentalmente pelo diff (`git diff HEAD~3 --stat`) conferindo que `dashboard.tsx` só perdeu código movido.
- [ ] **Step 2:** Rodar `npm run dev` e abrir `/dashboard/<slug-existente>` e a análise avulsa — smoke test próprio antes de chamar o Thallys.
- [ ] **Step 3: CHECKPOINT 2 (Thallys):** navegar por TODAS as abas nos dois fluxos (cliente com histórico + análise avulsa/Maria Maria). Tudo deve estar visualmente idêntico. Aguardar aprovação.

---

### Task 8: Seletor de datas ligado ao servidor

**Files:**
- Create: `src/lib/dates.ts`
- Modify: `src/routes/dashboard.$clientSlug.tsx` · `src/routes/dashboard.tsx` (prop nova em `DashboardContent`)
- Test: `test/dates.test.ts`

**Interfaces:**
- Produces: `toISODate(d: Date): string` (YYYY-MM-DD no fuso local). `DashboardContent` ganha prop opcional `onDateRangeChange?: (range: { from?: Date; to?: Date } | undefined) => void`, chamada sempre que o usuário muda o período (além do estado local, que continua filtrando em memória — filtrar duas vezes o mesmo intervalo é inócuo e preserva a análise avulsa).

- [ ] **Step 1: Teste que falha**

```typescript
// test/dates.test.ts
import { describe, it, expect } from "vitest";
import { toISODate } from "../src/lib/dates";

describe("toISODate", () => {
  it("formata Date como YYYY-MM-DD no fuso local (sem UTC shift)", () => {
    expect(toISODate(new Date(2026, 6, 12))).toBe("2026-07-12");
    expect(toISODate(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});
```

Run: `npx vitest run test/dates.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implementar**

```typescript
// src/lib/dates.ts
/** Formata uma data como YYYY-MM-DD usando os campos locais (America/Sao_Paulo na prática). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
```

Run: `npx vitest run test/dates.test.ts` — Expected: PASS.

- [ ] **Step 3: Search params na rota do cliente**

Em `dashboard.$clientSlug.tsx`, na definição da Route (linhas 12-22), adicionar:

```typescript
  validateSearch: (search: Record<string, unknown>): { start?: string; end?: string } => ({
    start: typeof search.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.start) ? search.start : undefined,
    end: typeof search.end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.end) ? search.end : undefined,
  }),
  loaderDeps: ({ search }) => ({ start: search.start, end: search.end }),
  loader: async ({ params, deps }) => {
    const result = await fetchClientData({
      data: { slug: params.clientSlug, start: deps.start, end: deps.end },
    });
    if (!result) throw notFound();
    return result;
  },
```

- [ ] **Step 4: Callback de navegação no componente**

Em `ClientDashboard` (mesmo arquivo):

```typescript
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  const onDateRangeChange = (range: { from?: Date; to?: Date } | undefined) => {
    navigate({
      search: {
        start: range?.from ? toISODate(range.from) : undefined,
        end: range?.to ? toISODate(range.to) : undefined,
      },
      replace: true,
    });
  };
```

E passar `onDateRangeChange={onDateRangeChange}` para `<DashboardContent …/>` (import de `toISODate` de `@/lib/dates`).

- [ ] **Step 5: Estado vazio correto (tratamento de erro do spec)**

No mesmo componente, o convite "Importe o primeiro CSV" só vale sem filtro ativo. Trocar a condição `if (rows.length === 0)` por:

```typescript
  const hasFilter = Boolean(search.start || search.end);
  if (rows.length === 0 && !hasFilter) {
    // …bloco atual do convite, inalterado…
  }
  if (rows.length === 0 && hasFilter) {
    return (
      <div className="min-h-screen">
        <BrandHeader showHomeLink />
        <main className="max-w-2xl mx-auto px-6 py-16 text-center space-y-6">
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <p className="text-muted-foreground">Sem dados no período selecionado.</p>
          <Button variant="outline" onClick={() => onDateRangeChange(undefined)}>
            Limpar filtro de datas
          </Button>
        </main>
      </div>
    );
  }
```

- [ ] **Step 6: Prop em `DashboardContent`**

Em `dashboard.tsx`, adicionar `onDateRangeChange` à assinatura de `DashboardContent` e, no ponto onde o `DateRangePicker` recebe `setDate`, passar um wrapper:

```typescript
  const handleDateRange = (range: { from?: Date; to?: Date } | undefined) => {
    setDateRange(range);
    onDateRangeChange?.(range);
  };
```

(usar `handleDateRange` no lugar de `setDateRange` APENAS no `DateRangePicker`; o resto do fluxo em memória fica como está — a análise avulsa não passa a prop e nada muda para ela).

- [ ] **Step 7:** `npm test` + `npm run build` verdes. Commit + CHECKPOINT 3.

```bash
git add src/lib/dates.ts test/dates.test.ts src/routes/dashboard.$clientSlug.tsx src/routes/dashboard.tsx
git commit -m "feat: seletor de datas ligado ao filtro de periodo do servidor"
```

**CHECKPOINT 3 (Thallys):** no dashboard de um cliente, trocar períodos e conferir que os números mudam coerentemente; limpar filtro volta ao total; período sem dados mostra a mensagem nova; análise avulsa segue igual. Aguardar aprovação.

---

### Task 9: Qualidade de dados no servidor (`src/lib/server/quality.ts`)

**Files:**
- Create: `src/lib/server/quality.ts`
- Modify: `src/lib/api.ts` (server fn `fetchDataQuality`; incluir `quality` em `serverDeps`)
- Test: `test/quality.test.ts`

**Interfaces:**
- Consumes: `getInsights`, `getDataRange` de `server/insights.ts`; `datasetFromRows` de `csv/parser.ts`.
- Produces:

```typescript
export type QualityLevel = "ok" | "atencao" | "problema";
export interface QualityIssue {
  kind: "dias_sem_dados" | "dados_desatualizados" | "colunas_ausentes" | "sem_dados";
  severity: "atencao" | "problema";
  message: string;   // PT-BR, pronto para exibir
  penalty: number;   // pontos descontados (explicabilidade)
}
export interface QualityReport {
  score: number;                                  // 0-100
  level: QualityLevel;                            // ok ≥90 · atencao ≥70 · problema <70
  issues: QualityIssue[];
  period: { start: string; end: string } | null;  // período efetivamente avaliado
}
export function computeQuality(db, clientId, opts?: { start?: string; end?: string; today?: string }): Promise<QualityReport>
```

- server fn `fetchDataQuality({ data: { slug, start?, end? } })` → `QualityReport | null`.

**Regras determinísticas (documentadas no código):** dia sem dados no período = −3 pontos cada (teto −30, severidade `atencao`; vira `problema` se >50% dos dias faltam) · última data de dados há >7 dias de `today` = −10 (`atencao`); >14 dias = −20 (`problema`) · coluna importante ausente no CSV (`spend`, `impressions`, `clicks`, `results`, `conversionValue`) = −5 cada (teto −25, `atencao`) · nenhum dado no período = score 0, `problema`, issue `sem_dados` com mensagem "Sem dados no período selecionado." · `today` é parâmetro injetável (default: data atual em America/Sao_Paulo via `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`).

- [ ] **Step 1: Teste que falha**

```typescript
// test/quality.test.ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights } from "../src/lib/server/insights";
import { computeQuality } from "../src/lib/server/quality";
import type { AdRow } from "../src/lib/csv/types";

const FULL_RAW = {
  "Valor usado (BRL)": "1", "Impressões": "1", "Cliques no link": "1",
  "Resultados": "1", "Valor de conversão da compra": "1",
};

function makeRow(overrides: Partial<AdRow> = {}): AdRow {
  return {
    campaignName: "Campanha A", adSetName: "Conjunto 1", adName: "Anúncio X",
    date: "2026-07-01", endDate: "2026-07-01", objective: "", delivery: "",
    budget: 0, budgetType: "", attribution: "",
    spend: 10, impressions: 100, reach: 80, frequency: 0,
    clicks: 5, ctr: 0, cpc: 0, cpm: 0,
    results: 1, resultIndicator: "", resultUnit: "", costPerResult: 0,
    purchases: 0, cpa: 0, conversionValue: 0, averageConversionValue: 0, roas: 0,
    conversations: 0, costPerConversation: 0,
    videoPlays: 0, thruplays: 0, video25: 0, video50: 0, video75: 0, video95: 0,
    engagement: 0, reactions: 0, comments: 0, shares: 0, ctrTodos: 0,
    rawData: FULL_RAW,
    ...overrides,
  };
}

describe("qualidade de dados v1", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `Q${Date.now()}${Math.random()}`,
      slug: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("dados completos e recentes → score 100, nível ok, sem issues", async () => {
    await upsertInsights(env.DB, clientId, [
      makeRow({ date: "2026-07-10" }),
      makeRow({ date: "2026-07-11" }),
      makeRow({ date: "2026-07-12" }),
    ], "csv");
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    expect(r.score).toBe(100);
    expect(r.level).toBe("ok");
    expect(r.issues).toHaveLength(0);
    expect(r.period).toEqual({ start: "2026-07-10", end: "2026-07-12" });
  });

  it("buracos no período descontam 3 pontos por dia e explicam quais dias", async () => {
    await upsertInsights(env.DB, clientId, [
      makeRow({ date: "2026-07-08" }),
      makeRow({ date: "2026-07-12" }), // faltam 09, 10, 11
    ], "csv");
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    expect(r.score).toBe(91); // 100 - 3*3
    expect(r.level).toBe("ok");
    const issue = r.issues.find((i) => i.kind === "dias_sem_dados");
    expect(issue).toBeDefined();
    expect(issue!.penalty).toBe(9);
    expect(issue!.message).toContain("2026-07-09");
  });

  it("dados desatualizados: >7 dias = atenção, >14 dias = problema", async () => {
    await upsertInsights(env.DB, clientId, [makeRow({ date: "2026-07-01" })], "csv");
    const r8 = await computeQuality(env.DB, clientId, { today: "2026-07-09" });
    expect(r8.issues.find((i) => i.kind === "dados_desatualizados")!.penalty).toBe(10);
    const r15 = await computeQuality(env.DB, clientId, { today: "2026-07-16" });
    expect(r15.issues.find((i) => i.kind === "dados_desatualizados")!.penalty).toBe(20);
  });

  it("coluna importante ausente no CSV desconta 5 e cita a métrica", async () => {
    const raw = { "Impressões": "1", "Cliques no link": "1", "Resultados": "1", "Valor de conversão da compra": "1" }; // sem investimento
    await upsertInsights(env.DB, clientId, [makeRow({ date: "2026-07-12", rawData: raw })], "csv");
    const r = await computeQuality(env.DB, clientId, { today: "2026-07-12" });
    const issue = r.issues.find((i) => i.kind === "colunas_ausentes");
    expect(issue).toBeDefined();
    expect(issue!.penalty).toBe(5);
    expect(issue!.message).toContain("Investimento");
  });

  it("sem dados no período → score 0, nível problema, mensagem clara", async () => {
    const r = await computeQuality(env.DB, clientId, { start: "2030-01-01", end: "2030-01-31", today: "2026-07-12" });
    expect(r.score).toBe(0);
    expect(r.level).toBe("problema");
    expect(r.issues[0].kind).toBe("sem_dados");
    expect(r.issues[0].message).toBe("Sem dados no período selecionado.");
  });
});
```

**Atenção:** os cabeçalhos de `FULL_RAW` precisam bater com os aliases reconhecidos por `buildColumnIndex` em `src/lib/csv/normalize.ts` para as 5 métricas importantes — conferir os aliases reais no arquivo antes de rodar e ajustar as chaves do fixture se necessário (o rótulo "Investimento"/label da métrica vem de `METRIC_LABELS`/equivalente em normalize; usar o label real).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/quality.test.ts` — Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `quality.ts`**

```typescript
// src/lib/server/quality.ts
import type { D1Database } from "@cloudflare/workers-types";
import { getInsights } from "./insights";
import { datasetFromRows } from "../csv/parser";
import type { CanonicalKey } from "../csv/normalize";

export type QualityLevel = "ok" | "atencao" | "problema";

export interface QualityIssue {
  kind: "dias_sem_dados" | "dados_desatualizados" | "colunas_ausentes" | "sem_dados";
  severity: "atencao" | "problema";
  message: string;
  penalty: number;
}

export interface QualityReport {
  score: number;
  level: QualityLevel;
  issues: QualityIssue[];
  period: { start: string; end: string } | null;
}

/** Métricas cuja ausência no CSV compromete a análise. */
const IMPORTANT_METRICS: { key: CanonicalKey; label: string }[] = [
  { key: "spend", label: "Investimento" },
  { key: "impressions", label: "Impressões" },
  { key: "clicks", label: "Cliques no link" },
  { key: "results", label: "Resultados" },
  { key: "conversionValue", label: "Faturamento" },
];

/** Hoje em America/Sao_Paulo como YYYY-MM-DD ("en-CA" formata nesse padrão). */
function todaySaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Lista todos os dias YYYY-MM-DD entre start e end (inclusivos). */
function calendarDays(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Dias entre duas datas YYYY-MM-DD (b - a). */
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000,
  );
}

function levelFor(score: number): QualityLevel {
  if (score >= 90) return "ok";
  if (score >= 70) return "atencao";
  return "problema";
}

/**
 * Qualidade de dados v1 — pontuação explicável, calculada na hora (sem tabela).
 * Regras: dia sem dados −3 (teto −30) · dados >7 dias velhos −10 / >14 dias −20 ·
 * coluna importante ausente −5 cada (teto −25) · sem dados = 0.
 */
export async function computeQuality(
  db: D1Database,
  clientId: number,
  opts?: { start?: string; end?: string; today?: string },
): Promise<QualityReport> {
  const today = opts?.today ?? todaySaoPaulo();
  const rows = await getInsights(db, clientId, { start: opts?.start, end: opts?.end });

  if (rows.length === 0) {
    return {
      score: 0,
      level: "problema",
      issues: [
        {
          kind: "sem_dados",
          severity: "problema",
          message: "Sem dados no período selecionado.",
          penalty: 100,
        },
      ],
      period: opts?.start && opts?.end ? { start: opts.start, end: opts.end } : null,
    };
  }

  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  const start = opts?.start ?? dates[0];
  const end = opts?.end ?? dates[dates.length - 1];
  const issues: QualityIssue[] = [];

  // 1) Dias sem dados dentro do período avaliado
  const have = new Set(dates);
  const missing = calendarDays(start, end).filter((d) => !have.has(d));
  if (missing.length > 0) {
    const total = calendarDays(start, end).length;
    const penalty = Math.min(30, missing.length * 3);
    const shown = missing.slice(0, 5).join(", ");
    const rest = missing.length > 5 ? ` e mais ${missing.length - 5}` : "";
    issues.push({
      kind: "dias_sem_dados",
      severity: missing.length > total / 2 ? "problema" : "atencao",
      message: `${missing.length} dia(s) sem dados no período: ${shown}${rest}.`,
      penalty,
    });
  }

  // 2) Dados desatualizados (última data de dados vs hoje)
  const lastDate = dates[dates.length - 1];
  const age = daysBetween(lastDate, today);
  if (age > 14) {
    issues.push({
      kind: "dados_desatualizados",
      severity: "problema",
      message: `Última data com dados é ${lastDate} (há ${age} dias). Importe um CSV mais recente.`,
      penalty: 20,
    });
  } else if (age > 7) {
    issues.push({
      kind: "dados_desatualizados",
      severity: "atencao",
      message: `Última data com dados é ${lastDate} (há ${age} dias).`,
      penalty: 10,
    });
  }

  // 3) Colunas importantes ausentes no CSV importado (via rawData preservado)
  const ds = datasetFromRows(rows, "banco");
  const absent = IMPORTANT_METRICS.filter((m) => ds.missingMetrics.includes(m.key));
  if (absent.length > 0) {
    issues.push({
      kind: "colunas_ausentes",
      severity: "atencao",
      message: `Coluna(s) ausente(s) no CSV importado: ${absent.map((m) => m.label).join(", ")}.`,
      penalty: Math.min(25, absent.length * 5),
    });
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.penalty, 0));
  return { score, level: levelFor(score), issues, period: { start, end } };
}
```

- [ ] **Step 4:** Adicionar `import("./server/quality")` ao `serverDeps()` de `api.ts` e o server fn:

```typescript
export const fetchDataQuality = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; start?: string; end?: string }) => input)
  .handler(async ({ data }) => {
    const { db, getClientBySlug, computeQuality } = await serverDeps();
    const client = await getClientBySlug(db, data.slug);
    if (!client) return null;
    return computeQuality(db, client.id, { start: data.start, end: data.end });
  });
```

- [ ] **Step 5:** `npx vitest run test/quality.test.ts` PASS → `npm test` + `npm run build` verdes → commit.

```bash
git add src/lib/server/quality.ts src/lib/api.ts test/quality.test.ts
git commit -m "feat: qualidade de dados v1 no servidor (pontuacao explicavel)"
```

---

### Task 10: Selo de qualidade na UI

**Files:**
- Create: `src/components/dashboard/QualityBadge.tsx`
- Modify: `src/routes/dashboard.tsx` (renderizar o selo no cabeçalho quando houver `uploadSlug`) · `src/routes/dashboard.$clientSlug.tsx` (nada — o slug já chega via `uploadSlug`)

**Interfaces:**
- Consumes: `fetchDataQuality` (Task 9); `QualityReport` (importar só o TIPO: `import type { QualityReport } from "@/lib/server/quality"` — type-only não entra no bundle).
- Produces: `QualityBadge({ slug, start, end }: { slug: string; start?: string; end?: string })`.

- [ ] **Step 1: Implementar o componente**

```tsx
// src/components/dashboard/QualityBadge.tsx
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { fetchDataQuality } from "@/lib/api";
import type { QualityReport } from "@/lib/server/quality";
import { GOLD, WARNING, DANGER } from "./theme";

const LEVEL_UI = {
  ok: { color: GOLD, Icon: ShieldCheck, label: "Dados OK" },
  atencao: { color: WARNING, Icon: ShieldAlert, label: "Atenção nos dados" },
  problema: { color: DANGER, Icon: ShieldX, label: "Problema nos dados" },
} as const;

export function QualityBadge({ slug, start, end }: { slug: string; start?: string; end?: string }) {
  const [report, setReport] = useState<QualityReport | null>(null);

  useEffect(() => {
    let alive = true;
    fetchDataQuality({ data: { slug, start, end } })
      .then((r) => { if (alive) setReport(r); })
      .catch(() => { if (alive) setReport(null); });
    return () => { alive = false; };
  }, [slug, start, end]);

  if (!report) return null;
  const { color, Icon, label } = LEVEL_UI[report.level];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-[oklch(0.83_0.16_88_/_0.08)]"
          style={{ borderColor: color, color }}
          title="Qualidade dos dados do período — clique para detalhes"
        >
          <Icon className="w-3.5 h-3.5" />
          {label} · {report.score}%
        </button>
      </DialogTrigger>
      <DialogContent className="bg-[oklch(0.12_0_0)] border-[oklch(0.83_0.16_88_/_0.2)]">
        <DialogHeader>
          <DialogTitle style={{ color }}>Qualidade dos dados — {report.score}%</DialogTitle>
        </DialogHeader>
        {report.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum problema encontrado no período{report.period ? ` de ${report.period.start} a ${report.period.end}` : ""}.
          </p>
        ) : (
          <ul className="space-y-3">
            {report.issues.map((issue, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: issue.severity === "problema" ? DANGER : WARNING }}
                />
                <span className="text-foreground">
                  {issue.message}{" "}
                  <span className="text-muted-foreground">(−{issue.penalty} pontos)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Renderizar no cabeçalho**

Em `dashboard.tsx`, dentro de `DashboardContent`, no bloco de controles onde o `DateRangePicker` é renderizado, adicionar ao lado:

```tsx
{uploadSlug && (
  <QualityBadge
    slug={uploadSlug}
    start={dateRange?.from ? toISODate(dateRange.from) : undefined}
    end={dateRange?.to ? toISODate(dateRange.to) : undefined}
  />
)}
```

(import de `QualityBadge` e `toISODate`; a análise avulsa não tem `uploadSlug`, logo não exibe o selo — ela já tem a aba "Qualidade dos dados" própria).

- [ ] **Step 3:** `npm run build` + `npm test` verdes. Commit + CHECKPOINT 4.

```bash
git add src/components/dashboard/QualityBadge.tsx src/routes/dashboard.tsx
git commit -m "feat: selo de qualidade de dados no dashboard do cliente"
```

**CHECKPOINT 4 (Thallys):** dashboard de cliente com dados completos → selo dourado; escolher um período com buracos → selo âmbar/vermelho com detalhes claros ao clicar; análise avulsa sem selo (usa a aba própria). Aguardar aprovação.

---

### Task 11: Documentação e encerramento

**Files:**
- Modify: `docs/dashboard-de-ouro/roadmap.md` (marcar 1.3-UI, 1.4, 1.5, 1.6 como feitos, com data e resumo de 1 linha cada) · `docs/dashboard-de-ouro/architecture.md` (novos módulos: `metrics/formulas.ts`, `server/metrics.ts`, `server/quality.ts`, componentes em `components/dashboard/`) · `docs/dashboard-de-ouro/data-model.md` (nota: qualidade v1 é calculada na hora, sem tabela)
- Modify (brain): `C:\GitHub\audiencia-brain\wiki\areas\audiencia-de-ouro\` — log de sessões e nota de arquitetura, conforme protocolo do CLAUDE.md

- [ ] **Step 1:** Atualizar os três docs do repo.
- [ ] **Step 2:** Atualizar o log de sessões no brain (o que foi feito, decisões, próximo passo sugerido: Fase 2 — funil e comparações).
- [ ] **Step 3:** Commit final.

```bash
git add docs/
git commit -m "docs: fase 1 concluida — metricas no servidor, dashboard decomposto, filtro de datas e qualidade v1"
```

---

## Fora do plano (lembretes)

- ⚠️ Antes do próximo deploy (quando o Thallys pedir): `wrangler secret put AUTH_EMAIL` / `AUTH_PASSWORD` e `wrangler d1 migrations apply dashboard-de-ouro --remote` (migrações 0004-0006) — pendência registrada no roadmap.
- Meta API e Fase 2 ficam para planos próprios.
