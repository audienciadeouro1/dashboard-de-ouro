# Fase 2B — Funil real + ROAS/CAC — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aba "Funil" que une Meta Ads + dados comerciais com taxas/perdas por etapa e ROAS/CAC/ticket reais, determinístico no servidor, aditivo (não altera a Maria Maria atual).

**Architecture:** Cálculo puro em `src/lib/metrics/funnel.ts`; montagem no servidor em `src/lib/server/funnel.ts` (reusa `getClientTotals` + `getCommercialPeriods`); server function `fetchClientFunnel`; UI `FunnelTab` ligada ao dashboard.

## Global Constraints

- Aditivo: não mexer na Overview/Maria Maria atual; não dropar `external_weekly_data`.
- Divisões por zero → 0. Financeiro BRL, datas `YYYY-MM-DD`.
- Código de banco só em `server/`. UI PT-BR. Sem deploy. Manter 56 testes verdes; gate = `npm test` + `npm run build`.

---

### Task 1: `deriveFunnel` puro — `src/lib/metrics/funnel.ts`

**Files:** Create `src/lib/metrics/funnel.ts`; Test `test/funnel-derive.test.ts`.

**Interfaces — Produces:**
```ts
export interface FunnelStage { key: string; label: string; source: "meta" | "commercial"; count: number }
export interface FunnelStageResult extends FunnelStage { conversionFromPrev: number | null; dropFromPrev: number | null }
export interface FunnelResult { stages: FunnelStageResult[]; spend: number; revenue: number; sales: number; roas: number; cac: number; ticket: number }
export function deriveFunnel(stages: FunnelStage[], spend: number, revenue: number): FunnelResult
```

- [ ] **Step 1: Teste que falha** — `test/funnel-derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveFunnel, type FunnelStage } from "../src/lib/metrics/funnel";

const stages: FunnelStage[] = [
  { key: "impressions", label: "Impressões", source: "meta", count: 1000 },
  { key: "conversations", label: "Conversas", source: "meta", count: 100 },
  { key: "contatos", label: "Contatos", source: "commercial", count: 80 },
  { key: "vendas", label: "Vendas", source: "commercial", count: 20 },
];

describe("deriveFunnel", () => {
  it("calcula conversão e perda por etapa", () => {
    const r = deriveFunnel(stages, 1000, 5000);
    expect(r.stages[0].conversionFromPrev).toBeNull();
    expect(r.stages[1].conversionFromPrev).toBeCloseTo(0.1);
    expect(r.stages[1].dropFromPrev).toBe(900);
    expect(r.stages[3].conversionFromPrev).toBeCloseTo(0.25);
  });
  it("vendas = última etapa; ROAS/CAC/ticket reais", () => {
    const r = deriveFunnel(stages, 1000, 5000);
    expect(r.sales).toBe(20);
    expect(r.roas).toBeCloseTo(5);
    expect(r.cac).toBeCloseTo(50);
    expect(r.ticket).toBeCloseTo(250);
  });
  it("divisão por zero → 0 e perda nunca negativa", () => {
    const r = deriveFunnel(
      [
        { key: "a", label: "A", source: "meta", count: 0 },
        { key: "b", label: "B", source: "commercial", count: 10 },
      ],
      0,
      0,
    );
    expect(r.roas).toBe(0);
    expect(r.cac).toBe(0);
    expect(r.ticket).toBe(0);
    expect(r.stages[1].conversionFromPrev).toBe(0);
    expect(r.stages[1].dropFromPrev).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- funnel-derive` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/metrics/funnel.ts`:

```ts
export interface FunnelStage {
  key: string;
  label: string;
  source: "meta" | "commercial";
  count: number;
}
export interface FunnelStageResult extends FunnelStage {
  conversionFromPrev: number | null;
  dropFromPrev: number | null;
}
export interface FunnelResult {
  stages: FunnelStageResult[];
  spend: number;
  revenue: number;
  sales: number;
  roas: number;
  cac: number;
  ticket: number;
}

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

export function deriveFunnel(stages: FunnelStage[], spend: number, revenue: number): FunnelResult {
  const out: FunnelStageResult[] = stages.map((s, i) => {
    if (i === 0) return { ...s, conversionFromPrev: null, dropFromPrev: null };
    const prev = stages[i - 1].count;
    return {
      ...s,
      conversionFromPrev: prev > 0 ? s.count / prev : 0,
      dropFromPrev: Math.max(0, prev - s.count),
    };
  });
  const commercial = stages.filter((s) => s.source === "commercial");
  const sales = commercial.length > 0 ? commercial[commercial.length - 1].count : 0;
  return {
    stages: out,
    spend,
    revenue,
    sales,
    roas: safeDiv(revenue, spend),
    cac: safeDiv(spend, sales),
    ticket: safeDiv(revenue, sales),
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- funnel-derive` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/metrics/funnel.ts test/funnel-derive.test.ts && git commit -m "feat: deriveFunnel puro (conversao/perda por etapa + ROAS/CAC/ticket)"`

---

### Task 2: Montagem no servidor — `src/lib/server/funnel.ts`

**Files:** Create `src/lib/server/funnel.ts`; Test `test/funnel-server.test.ts`.

**Interfaces:**
- Consumes: `getClientTotals` (metrics.ts), `getCommercialPeriods` (commercial.ts), `getFunnelConfig` (funnel-config.ts), `parseBRNumber` (csv/commercial.ts), `deriveFunnel` (Task 1), `type FunnelConfig`.
- Produces: `getClientFunnel(db, clientId, range?): Promise<FunnelResult | null>`; helper puro exportado `periodOverlaps(pStart, pEnd, range): boolean`.

- [ ] **Step 1: Teste que falha** — `test/funnel-server.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertCommercialPeriods } from "../src/lib/server/commercial";
import { saveFunnelConfig } from "../src/lib/server/funnel-config";
import { getClientFunnel, periodOverlaps } from "../src/lib/server/funnel";
import type { FunnelConfig } from "../src/lib/csv/types";

const CONFIG: FunnelConfig = {
  metaStages: [{ key: "conversations", label: "Conversas iniciadas" }],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [
      { key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" },
      { key: "vendas", label: "Vendas", column: "Agendamentos com serviço" },
    ],
  },
};

describe("periodOverlaps", () => {
  it("detecta sobreposição com o range", () => {
    expect(periodOverlaps("2026-04-16", "2026-04-18", { start: "2026-04-17", end: "2026-04-30" })).toBe(true);
    expect(periodOverlaps("2026-04-16", "2026-04-18", { start: "2026-05-01", end: "2026-05-30" })).toBe(false);
    expect(periodOverlaps("2026-04-16", "2026-04-18", undefined)).toBe(true);
  });
});

describe("getClientFunnel", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "maria-maria",
    });
    clientId = c.id;
  });

  it("retorna null sem config", async () => {
    expect(await getClientFunnel(env.DB, clientId)).toBeNull();
  });

  it("soma etapas comerciais (números BR) e usa a última como vendas", async () => {
    await saveFunnelConfig(env.DB, clientId, CONFIG);
    await upsertCommercialPeriods(env.DB, clientId, [
      { startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04", row: { "Contatos Whatsapp": "28", "Agendamentos com serviço": "2", Total: "284,9" } },
      { startDate: "2026-04-19", endDate: "2026-04-25", label: "19/04 a 25/04", row: { "Contatos Whatsapp": "138", "Agendamentos com serviço": "5", Total: "1300" } },
    ]);
    const f = await getClientFunnel(env.DB, clientId);
    expect(f).not.toBeNull();
    const contatos = f!.stages.find((s) => s.key === "contatos")!;
    expect(contatos.count).toBe(166);
    expect(f!.sales).toBe(7);
    expect(f!.revenue).toBeCloseTo(1584.9);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- funnel-server` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/server/funnel.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import { getClientTotals, type MetricsRange } from "./metrics";
import { getCommercialPeriods } from "./commercial";
import { getFunnelConfig } from "./funnel-config";
import { parseBRNumber } from "../csv/commercial";
import { deriveFunnel, type FunnelStage, type FunnelResult } from "../metrics/funnel";
import type { Totals } from "../csv/aggregate";

export function periodOverlaps(pStart: string, pEnd: string, range?: MetricsRange): boolean {
  if (!range || (!range.start && !range.end)) return true;
  const rStart = range.start ?? "0000-01-01";
  const rEnd = range.end ?? "9999-12-31";
  return pStart <= rEnd && pEnd >= rStart;
}

const META_FIELD: Record<string, keyof Totals> = {
  impressions: "impressions",
  clicks: "clicks",
  conversations: "conversations",
  reach: "reach",
  purchases: "purchases",
};

export async function getClientFunnel(
  db: D1Database,
  clientId: number,
  range?: MetricsRange,
): Promise<FunnelResult | null> {
  const config = await getFunnelConfig(db, clientId);
  if (!config) return null;

  const totals = await getClientTotals(db, clientId, range);
  const periods = (await getCommercialPeriods(db, clientId)).filter((p) =>
    periodOverlaps(p.startDate, p.endDate, range),
  );

  const stages: FunnelStage[] = [];
  for (const ms of config.metaStages) {
    const field = META_FIELD[ms.key];
    const count = field ? Number(totals[field] ?? 0) : 0;
    stages.push({ key: ms.key, label: ms.label, source: "meta", count });
  }
  for (const cs of config.commercial.stages) {
    let count = 0;
    for (const p of periods) count += parseBRNumber(p.row[cs.column]);
    stages.push({ key: cs.key, label: cs.label, source: "commercial", count });
  }

  let revenue = 0;
  for (const p of periods) revenue += parseBRNumber(p.row[config.commercial.revenueColumn]);

  return deriveFunnel(stages, totals.spend, revenue);
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- funnel-server` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/server/funnel.ts test/funnel-server.test.ts && git commit -m "feat: getClientFunnel (junta Meta + comercial por periodo)"`

---

### Task 3: Server function `fetchClientFunnel` em `api.ts`

**Files:** Modify `src/lib/api.ts`.

**Interfaces — Produces:** `fetchClientFunnel({ slug, start?, end? }): Promise<FunnelResult | null>`.

- [ ] **Step 1: Adicionar `./server/funnel` às `serverDeps`** — no `Promise.all`: `import("./server/funnel"),` e espalhar `...funnel` no retorno (renomeie o local para evitar colisão com `getClientFunnel`? não há colisão; use `funnel` como nome do módulo).

- [ ] **Step 2: Adicionar a server function** (após `fetchCommercialData`):

```ts
export const fetchClientFunnel = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; start?: string; end?: string }) => input)
  .handler(async ({ data }) => {
    const { db, getClientBySlug, getClientFunnel } = await serverDeps();
    const client = await getClientBySlug(db, data.slug);
    if (!client) return null;
    return getClientFunnel(db, client.id, { start: data.start, end: data.end });
  });
```

- [ ] **Step 3: Build + testes** — `npm run build` OK; `npm test` verde.

- [ ] **Step 4: Commit** — `git add src/lib/api.ts && git commit -m "feat: server function fetchClientFunnel"`

---

### Task 4: UI — aba "Funil" no dashboard

**Files:** Create `src/components/dashboard/FunnelTab.tsx`; Modify `src/routes/dashboard.$clientSlug.tsx` (carregar funil) e `src/routes/dashboard.tsx` (aba + render).

**Interfaces:** Consumes `fetchClientFunnel`, `type FunnelResult`, `fmtBRL`/`fmtNum` existentes.

- [ ] **Step 1: Carregar o funil no loader** de `dashboard.$clientSlug.tsx`: após `fetchClientData`, chamar `fetchClientFunnel({ data: { slug, start, end } })` em paralelo; retornar `funnel` junto. Passar `funnel` para `DashboardContent` via `dataOverride` (adicionar campo opcional `funnel?: FunnelResult | null`).

- [ ] **Step 2: `FunnelTab.tsx`** — recebe `funnel: FunnelResult`. Renderiza:
  - Linha de KPIs: Faturamento, Investimento, ROAS (x), CAC (R$), Ticket (R$) — usando `fmtBRL`/`fmtNum`.
  - Funil vertical: para cada etapa, barra com largura proporcional a `count / stages[0].count`, rótulo, contagem (`fmtNum`), e — a partir da 2ª — `conversionFromPrev` (%) e `dropFromPrev` ("−N"). Etapas `source: "commercial"` com leve destaque dourado para marcar o handoff.
  - Cartão de handoff entre a última etapa Meta e a 1ª comercial: "Meta contou X; o negócio registrou Y" quando ambas existem.
  - Estilo dark/dourado consistente (reusar classes `glass-card`, `oklch(...)` como nos outros tabs).

- [ ] **Step 3: Registrar a aba** em `dashboard.tsx`: adicionar `["funnel", "Funil"]` à lista de tabs **somente quando** `funnel` existe e tem etapas comerciais com dados; adicionar `<TabsContent value="funnel"><FunnelTab funnel={funnel} /></TabsContent>`. `DashboardContent` recebe `funnel` via prop/`dataOverride`.

- [ ] **Step 4: Build + testes** — `npm run build` OK; `npm test` verde.

- [ ] **Step 5: Checkpoint do Thallys (localhost)** — abrir a Maria Maria (após ter importado o comercial na 2A e rodado o backfill), conferir a aba Funil com os números e que as demais abas seguem idênticas.

- [ ] **Step 6: Commit** — `git add src/components/dashboard/FunnelTab.tsx src/routes/dashboard.tsx src/routes/dashboard.\$clientSlug.tsx && git commit -m "feat: aba Funil (funil real Meta+comercial + ROAS/CAC/ticket)"`

---

## Self-Review (feito)

- **Cobertura:** deriveFunnel (T1) · getClientFunnel + overlap (T2) · server function (T3) · UI aba Funil (T4). Fora de escopo (comparador, aposentar external_weekly, diagnóstico do gap) permanece fora.
- **Placeholders:** nenhum nos passos de servidor/cálculo; T4 (UI) descreve render concreto com fontes de dados definidas.
- **Tipos:** `FunnelStage`/`FunnelResult` definidos em T1 e reusados em T2/T3/T4; `MetricsRange` reusado de metrics.ts.
