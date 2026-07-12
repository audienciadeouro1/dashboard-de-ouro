# Fase 2A — Fundação comercial genérica + importação com mapeamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que qualquer cliente importe dados comerciais (CSV) com etapas de funil configuráveis por cliente, aposentando o modelo "chumbado" da Maria Maria sem perder dados nem quebrar a UI atual.

**Architecture:** Espelha o padrão de `ad_daily_insights`: tabela `commercial_periods` guarda a linha crua (`row_json`) + datas + upsert idempotente; tabela `funnel_configs` guarda a definição do funil por cliente (etapas Meta + etapas comerciais + mapeamento de colunas) em JSON. Parsing puro e testável em `src/lib/csv/commercial.ts`. Repositórios em `src/lib/server/`. Server functions em `api.ts` via import dinâmico. UI de upload+mapeamento na rota de atualização do cliente.

**Tech Stack:** TanStack Start (React 19) · Cloudflare D1 · vitest + @cloudflare/vitest-pool-workers · PapaParse.

## Global Constraints

- Regra nº 1: **não quebrar** nada existente; a exibição atual da Maria Maria (lê `external_weekly_data`) permanece idêntica. Não dropar `external_weekly_data`.
- Código de banco só em `src/lib/server/`, importado dinamicamente por `api.ts`; nunca importar server estaticamente no cliente (tipo-only é permitido).
- Migração numerada em `migrations/` (próxima: `0008`).
- Coluna de data sempre `YYYY-MM-DD`; BRL em `REAL`; fuso America/Sao_Paulo.
- Escritas idempotentes (upsert); importar 2× não duplica.
- Textos de UI e erros em PT-BR.
- Manter os 43 testes atuais verdes; rodar `npm test`.
- Não fazer deploy (Thallys testa em localhost e decide).

---

### Task 1: Migração 0008 — tabelas `funnel_configs` e `commercial_periods`

**Files:**
- Create: `migrations/0008_commercial_funnel.sql`
- Test: `test/schema.test.ts` (adicionar casos)

**Interfaces:**
- Produces: tabelas `funnel_configs (client_id UNIQUE, config_json, updated_at)` e `commercial_periods (id, client_id, start_date, end_date, label, row_json, source, created_at, UNIQUE(client_id, start_date))`.

- [ ] **Step 1: Escrever o teste que falha** — em `test/schema.test.ts`, adicionar dentro de um novo `describe`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema comercial (migração 0008)", () => {
  it("cria funnel_configs com client_id único", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(funnel_configs)").all<{ name: string }>();
    const cols = results.map((r) => r.name);
    expect(cols).toEqual(expect.arrayContaining(["client_id", "config_json", "updated_at"]));
  });

  it("cria commercial_periods com colunas esperadas", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(commercial_periods)").all<{ name: string }>();
    const cols = results.map((r) => r.name);
    expect(cols).toEqual(
      expect.arrayContaining(["id", "client_id", "start_date", "end_date", "label", "row_json", "source", "created_at"]),
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- schema` → FAIL (tabelas não existem).

- [ ] **Step 3: Criar a migração** — `migrations/0008_commercial_funnel.sql`:

```sql
-- Fase 2A: dados comerciais genéricos + configuração de funil por cliente.

-- Definição do funil por cliente (etapas Meta + etapas comerciais + mapeamento).
CREATE TABLE funnel_configs (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  config_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dados comerciais importados (resumo por período), linha crua preservada.
CREATE TABLE commercial_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,          -- YYYY-MM-DD
  end_date TEXT NOT NULL,            -- YYYY-MM-DD
  label TEXT NOT NULL DEFAULT '',    -- texto original do período (ex: "16/04 a 18/04")
  row_json TEXT NOT NULL,            -- linha crua completa do CSV
  source TEXT NOT NULL DEFAULT 'csv',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, start_date)
);
CREATE INDEX idx_commercial_periods_client ON commercial_periods (client_id, start_date);
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- schema` → PASS. (vitest-pool-workers aplica migrações automaticamente.)

- [ ] **Step 5: Commit**

```bash
git add migrations/0008_commercial_funnel.sql test/schema.test.ts
git commit -m "feat: migracao 0008 (funnel_configs + commercial_periods)"
```

---

### Task 2: Parsing puro do CSV comercial — `src/lib/csv/commercial.ts`

**Files:**
- Create: `src/lib/csv/commercial.ts`
- Modify: `src/lib/csv/types.ts` (adicionar tipo `FunnelConfig`)
- Test: `test/commercial-parse.test.ts`

**Interfaces:**
- Produces:
  - `parseBRNumber(v: string | number | undefined): number` — "1.359,90"/"284,9"/260 → number; vazio/"–"/"7,14%" com % → tratados (ver testes).
  - `parsePeriodRange(text: string, refYear: number): { startDate: string; endDate: string } | null` — "16/04 a 18/04" → `{startDate:"YYYY-04-16", endDate:"YYYY-04-18"}`; vira o ano em `m2 < m1`.
  - `type FunnelConfig` (em `types.ts`):
    ```ts
    export interface FunnelStageMeta { key: string; label: string }
    export interface FunnelStageCommercial { key: string; label: string; column: string }
    export interface FunnelConfig {
      metaStages: FunnelStageMeta[];
      commercial: {
        periodColumn: string;
        revenueColumn: string;
        ticketColumn?: string;
        stages: FunnelStageCommercial[];
      };
    }
    ```

- [ ] **Step 1: Escrever os testes que falham** — `test/commercial-parse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseBRNumber, parsePeriodRange } from "../src/lib/csv/commercial";

describe("parseBRNumber", () => {
  it("converte número BR com vírgula decimal e milhar", () => {
    expect(parseBRNumber("1.359,90")).toBeCloseTo(1359.9);
    expect(parseBRNumber("284,9")).toBeCloseTo(284.9);
    expect(parseBRNumber(260)).toBe(260);
    expect(parseBRNumber("260")).toBe(260);
  });
  it("trata vazio, traço e ausente como 0", () => {
    expect(parseBRNumber("")).toBe(0);
    expect(parseBRNumber("–")).toBe(0);
    expect(parseBRNumber(undefined)).toBe(0);
  });
});

describe("parsePeriodRange", () => {
  it("converte intervalo DD/MM a DD/MM usando o ano de referência", () => {
    expect(parsePeriodRange("16/04 a 18/04", 2026)).toEqual({
      startDate: "2026-04-16",
      endDate: "2026-04-18",
    });
  });
  it("vira o ano quando o mês final é menor que o inicial", () => {
    expect(parsePeriodRange("28/12 a 03/01", 2025)).toEqual({
      startDate: "2025-12-28",
      endDate: "2026-01-03",
    });
  });
  it("retorna null para texto sem datas", () => {
    expect(parsePeriodRange("Total Geral", 2026)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- commercial-parse` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar** — `src/lib/csv/commercial.ts`:

```ts
export function parseBRNumber(v: string | number | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const cleaned = v.trim();
  if (cleaned === "" || cleaned === "–" || cleaned === "-") return 0;
  // remove % e espaços; remove separador de milhar "."; troca vírgula decimal por ponto
  const n = parseFloat(cleaned.replace(/%/g, "").replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parsePeriodRange(
  text: string,
  refYear: number,
): { startDate: string; endDate: string } | null {
  if (!text) return null;
  const parts = text.split(/ a | /i).filter((p) => p.includes("/"));
  if (parts.length < 2) return null;
  const [d1, m1] = parts[0].split("/").map((n) => parseInt(n, 10));
  const [d2, m2] = parts[1].split("/").map((n) => parseInt(n, 10));
  if ([d1, m1, d2, m2].some((n) => Number.isNaN(n))) return null;
  const yearEnd = m2 < m1 ? refYear + 1 : refYear;
  return {
    startDate: `${refYear}-${pad2(m1)}-${pad2(d1)}`,
    endDate: `${yearEnd}-${pad2(m2)}-${pad2(d2)}`,
  };
}
```

E adicionar o bloco de tipos `FunnelConfig` (acima em Interfaces) ao fim de `src/lib/csv/types.ts`.

- [ ] **Step 4: Rodar e ver passar** — `npm test -- commercial-parse` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv/commercial.ts src/lib/csv/types.ts test/commercial-parse.test.ts
git commit -m "feat: parsing puro do CSV comercial (numeros BR + intervalo de datas)"
```

---

### Task 3: Repositório `funnel_configs` — `src/lib/server/funnel-config.ts`

**Files:**
- Create: `src/lib/server/funnel-config.ts`
- Test: `test/funnel-config.test.ts`

**Interfaces:**
- Consumes: `type FunnelConfig` de `src/lib/csv/types.ts`.
- Produces:
  - `getFunnelConfig(db, clientId): Promise<FunnelConfig | null>`
  - `saveFunnelConfig(db, clientId, config: FunnelConfig): Promise<void>` (upsert por `client_id`).

- [ ] **Step 1: Escrever o teste que falha** — `test/funnel-config.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { getFunnelConfig, saveFunnelConfig } from "../src/lib/server/funnel-config";
import type { FunnelConfig } from "../src/lib/csv/types";

const CONFIG: FunnelConfig = {
  metaStages: [{ key: "conversations", label: "Conversas iniciadas" }],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [{ key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" }],
  },
};

describe("funnel_configs", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("retorna null quando não há config", async () => {
    expect(await getFunnelConfig(env.DB, clientId)).toBeNull();
  });

  it("salva e relê a config; segundo save sobrescreve (sem duplicar)", async () => {
    await saveFunnelConfig(env.DB, clientId, CONFIG);
    expect(await getFunnelConfig(env.DB, clientId)).toEqual(CONFIG);

    const updated = { ...CONFIG, commercial: { ...CONFIG.commercial, revenueColumn: "Faturamento" } };
    await saveFunnelConfig(env.DB, clientId, updated);
    expect(await getFunnelConfig(env.DB, clientId)).toEqual(updated);

    const { results } = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM funnel_configs WHERE client_id = ?")
      .bind(clientId)
      .all<{ n: number }>();
    expect(results[0].n).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- funnel-config` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/server/funnel-config.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import type { FunnelConfig } from "../csv/types";

export async function getFunnelConfig(
  db: D1Database,
  clientId: number,
): Promise<FunnelConfig | null> {
  const row = await db
    .prepare("SELECT config_json FROM funnel_configs WHERE client_id = ?")
    .bind(clientId)
    .first<{ config_json: string }>();
  if (!row) return null;
  return JSON.parse(row.config_json) as FunnelConfig;
}

export async function saveFunnelConfig(
  db: D1Database,
  clientId: number,
  config: FunnelConfig,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO funnel_configs (client_id, config_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT (client_id) DO UPDATE SET
         config_json = excluded.config_json,
         updated_at = excluded.updated_at`,
    )
    .bind(clientId, JSON.stringify(config))
    .run();
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- funnel-config` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/funnel-config.ts test/funnel-config.test.ts
git commit -m "feat: repositorio funnel_configs (config de funil por cliente)"
```

---

### Task 4: Repositório `commercial_periods` — `src/lib/server/commercial.ts`

**Files:**
- Create: `src/lib/server/commercial.ts`
- Test: `test/commercial-repo.test.ts`

**Interfaces:**
- Produces:
  - `interface CommercialPeriodInput { startDate: string; endDate: string; label: string; row: Record<string, string> }`
  - `interface CommercialPeriodRow { id: number; clientId: number; startDate: string; endDate: string; label: string; row: Record<string, string>; source: string }`
  - `upsertCommercialPeriods(db, clientId, periods: CommercialPeriodInput[]): Promise<number>` (upsert por `(client_id, start_date)`).
  - `getCommercialPeriods(db, clientId): Promise<CommercialPeriodRow[]>` (ordem `start_date ASC`).

- [ ] **Step 1: Escrever o teste que falha** — `test/commercial-repo.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertCommercialPeriods, getCommercialPeriods } from "../src/lib/server/commercial";

describe("commercial_periods", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "sales",
    });
    clientId = c.id;
  });

  it("insere e relê preservando a linha crua", async () => {
    const n = await upsertCommercialPeriods(env.DB, clientId, [
      { startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04", row: { Total: "284,9", Agendamentos: "2" } },
    ]);
    expect(n).toBe(1);
    const rows = await getCommercialPeriods(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ startDate: "2026-04-16", label: "16/04 a 18/04" });
    expect(rows[0].row.Total).toBe("284,9");
  });

  it("reimportar o mesmo período não duplica (upsert atualiza)", async () => {
    const p = { startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04", row: { Total: "284,9" } };
    await upsertCommercialPeriods(env.DB, clientId, [p]);
    await upsertCommercialPeriods(env.DB, clientId, [{ ...p, row: { Total: "999" } }]);
    const rows = await getCommercialPeriods(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0].row.Total).toBe("999");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- commercial-repo` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/server/commercial.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";

export interface CommercialPeriodInput {
  startDate: string;
  endDate: string;
  label: string;
  row: Record<string, string>;
}

export interface CommercialPeriodRow {
  id: number;
  clientId: number;
  startDate: string;
  endDate: string;
  label: string;
  row: Record<string, string>;
  source: string;
}

const UPSERT = `
INSERT INTO commercial_periods (client_id, start_date, end_date, label, row_json, source)
VALUES (?, ?, ?, ?, ?, 'csv')
ON CONFLICT (client_id, start_date) DO UPDATE SET
  end_date = excluded.end_date,
  label = excluded.label,
  row_json = excluded.row_json,
  source = excluded.source
`;

export async function upsertCommercialPeriods(
  db: D1Database,
  clientId: number,
  periods: CommercialPeriodInput[],
): Promise<number> {
  if (periods.length === 0) return 0;
  const stmt = db.prepare(UPSERT);
  const BATCH = 100;
  for (let i = 0; i < periods.length; i += BATCH) {
    const chunk = periods.slice(i, i + BATCH);
    await db.batch(
      chunk.map((p) =>
        stmt.bind(clientId, p.startDate, p.endDate, p.label, JSON.stringify(p.row)),
      ),
    );
  }
  return periods.length;
}

export async function getCommercialPeriods(
  db: D1Database,
  clientId: number,
): Promise<CommercialPeriodRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, client_id, start_date, end_date, label, row_json, source
       FROM commercial_periods WHERE client_id = ? ORDER BY start_date ASC`,
    )
    .bind(clientId)
    .all<{
      id: number;
      client_id: number;
      start_date: string;
      end_date: string;
      label: string;
      row_json: string;
      source: string;
    }>();
  return results.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    startDate: r.start_date,
    endDate: r.end_date,
    label: r.label,
    row: JSON.parse(r.row_json) as Record<string, string>,
    source: r.source,
  }));
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- commercial-repo` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/commercial.ts test/commercial-repo.test.ts
git commit -m "feat: repositorio commercial_periods (upsert idempotente por periodo)"
```

---

### Task 5: Server functions em `api.ts` (fetch/save config + import comercial + fetch dados)

**Files:**
- Modify: `src/lib/api.ts` (adicionar às `serverDeps` e novas server functions)
- Test: `test/commercial-api.test.ts` (testa a lógica de montagem de períodos a partir de linhas + config, sem a camada `createServerFn`)

**Interfaces:**
- Consumes: `parseBRNumber`, `parsePeriodRange` (Task 2), `upsertCommercialPeriods` (Task 4), `saveFunnelConfig`/`getFunnelConfig` (Task 3), `recordImport` (existente), `type FunnelConfig`.
- Produces (função pura exportada para teste, em `src/lib/csv/commercial.ts`):
  - `buildCommercialPeriods(rows: Record<string,string>[], config: FunnelConfig, refYear: number): CommercialPeriodInput[]` — usa `config.commercial.periodColumn` para achar o texto do período, `parsePeriodRange` para as datas, pula linhas sem período válido, preserva a linha crua.
- Produces (server functions): `fetchFunnelConfig`, `saveFunnelConfig` (POST), `importCommercialCsv` (POST), `fetchCommercialData`.

- [ ] **Step 1: Escrever o teste que falha** — `test/commercial-api.test.ts` (testa `buildCommercialPeriods`, a peça com risco):

```ts
import { describe, it, expect } from "vitest";
import { buildCommercialPeriods } from "../src/lib/csv/commercial";
import type { FunnelConfig } from "../src/lib/csv/types";

const config: FunnelConfig = {
  metaStages: [],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [{ key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" }],
  },
};

describe("buildCommercialPeriods", () => {
  it("monta períodos a partir das linhas e ignora linhas sem período válido", () => {
    const rows = [
      { Semana: "16/04 a 18/04", "Contatos Whatsapp": "28", Total: "284,9", TM: "142,45" },
      { Semana: "Total Geral", "Contatos Whatsapp": "191", Total: "3200", TM: "" },
    ];
    const out = buildCommercialPeriods(rows, config, 2026);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startDate: "2026-04-16", endDate: "2026-04-18", label: "16/04 a 18/04" });
    expect(out[0].row["Contatos Whatsapp"]).toBe("28");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- commercial-api` → FAIL (função não existe).

- [ ] **Step 3: Implementar `buildCommercialPeriods`** em `src/lib/csv/commercial.ts` (adicionar; importar o tipo `CommercialPeriodInput` de `../server/commercial` como tipo-only):

```ts
import type { FunnelConfig } from "./types";
import type { CommercialPeriodInput } from "../server/commercial";

export function buildCommercialPeriods(
  rows: Record<string, string>[],
  config: FunnelConfig,
  refYear: number,
): CommercialPeriodInput[] {
  const col = config.commercial.periodColumn;
  const out: CommercialPeriodInput[] = [];
  for (const row of rows) {
    const text = row[col];
    const range = parsePeriodRange(text, refYear);
    if (!range) continue;
    out.push({ startDate: range.startDate, endDate: range.endDate, label: text, row });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- commercial-api` → PASS.

- [ ] **Step 5: Ligar as server functions em `api.ts`** — adicionar os módulos às `serverDeps` (junto de `external`, `imports`):

```ts
// dentro do Promise.all de serverDeps():
import("./server/commercial"),
import("./server/funnel-config"),
```
e espalhá-los no retorno (`...commercial, ...funnelConfig`). Depois adicionar as server functions (seguindo o padrão de `ingestExternalWeeklyData`):

```ts
export const fetchFunnelConfig = createServerFn({ method: "GET" })
  .validator((clientId: number) => clientId)
  .handler(async ({ data: clientId }) => {
    const { db, getFunnelConfig } = await serverDeps();
    return getFunnelConfig(db, clientId);
  });

export const persistFunnelConfig = createServerFn({ method: "POST" })
  .validator((input: { clientId: number; config: FunnelConfig }) => input)
  .handler(async ({ data }) => {
    const { db, saveFunnelConfig } = await serverDeps();
    await saveFunnelConfig(db, data.clientId, data.config);
    return { ok: true };
  });

export const importCommercialCsv = createServerFn({ method: "POST" })
  .validator(
    (input: { clientId: number; rows: Record<string, string>[]; refYear: number; fileName?: string }) => input,
  )
  .handler(async ({ data }) => {
    const { db, getFunnelConfig, upsertCommercialPeriods, recordImport } = await serverDeps();
    const config = await getFunnelConfig(db, data.clientId);
    if (!config) throw new Error("Configure o mapeamento do funil antes de importar.");
    const { buildCommercialPeriods } = await import("./csv/commercial");
    const periods = buildCommercialPeriods(data.rows, config, data.refYear);
    const saved = await upsertCommercialPeriods(db, data.clientId, periods);
    await recordImport(db, data.clientId, {
      kind: "external_weekly",
      fileName: data.fileName,
      periodStart: periods[0]?.startDate ?? null,
      periodEnd: periods[periods.length - 1]?.endDate ?? null,
      rowsSaved: saved,
    });
    return { saved };
  });

export const fetchCommercialData = createServerFn({ method: "GET" })
  .validator((clientId: number) => clientId)
  .handler(async ({ data: clientId }) => {
    const { db, getCommercialPeriods } = await serverDeps();
    return getCommercialPeriods(db, clientId);
  });
```

Adicionar `import type { FunnelConfig } from "./csv/types";` no topo de `api.ts`.

- [ ] **Step 6: Rodar toda a suíte** — `npm test` → todos verdes (43 + novos). `npm run build` para checar tipos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api.ts src/lib/csv/commercial.ts test/commercial-api.test.ts
git commit -m "feat: server functions comerciais (config, import, leitura)"
```

---

### Task 6: Backfill — `external_weekly_data` → `commercial_periods` + seed da config Maria Maria

**Files:**
- Create: `src/lib/server/commercial-backfill.ts`
- Test: `test/commercial-backfill.test.ts`

**Interfaces:**
- Consumes: `upsertExternalWeeklyData`/`getExternalWeeklyData` (existentes), `upsertCommercialPeriods`, `saveFunnelConfig`.
- Produces:
  - `MARIA_MARIA_FUNNEL: FunnelConfig` (constante exportada com o mapeamento do salão).
  - `backfillCommercialFromExternal(db, clientId): Promise<{ periods: number }>` — lê `external_weekly_data`, reconstrói `row_json` (colunas originais do CSV do salão), grava em `commercial_periods`, e garante a config `MARIA_MARIA_FUNNEL`.

- [ ] **Step 1: Escrever o teste que falha** — `test/commercial-backfill.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertExternalWeeklyData } from "../src/lib/server/external";
import { getCommercialPeriods } from "../src/lib/server/commercial";
import { getFunnelConfig } from "../src/lib/server/funnel-config";
import { backfillCommercialFromExternal } from "../src/lib/server/commercial-backfill";

describe("backfill comercial", () => {
  let clientId: number;
  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "maria-maria",
    });
    clientId = c.id;
  });

  it("migra semanas do external_weekly_data para commercial_periods e cria a config", async () => {
    await upsertExternalWeeklyData(env.DB, clientId, [
      { startDate: "2026-04-16", endDate: "2026-04-18", contatosWhatsapp: 28, agendamentos: 2, agendamentosComServico: 2, faturamento: 284.9, ticketMedio: 142.45 },
    ]);
    const res = await backfillCommercialFromExternal(env.DB, clientId);
    expect(res.periods).toBe(1);

    const periods = await getCommercialPeriods(env.DB, clientId);
    expect(periods).toHaveLength(1);
    expect(periods[0].row["Contatos Whatsapp"]).toBe("28");
    expect(periods[0].row["Total"]).toBe("284.9");

    const config = await getFunnelConfig(env.DB, clientId);
    expect(config?.commercial.periodColumn).toBe("Semana");
    expect(config?.commercial.revenueColumn).toBe("Total");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- commercial-backfill` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/server/commercial-backfill.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import type { FunnelConfig } from "../csv/types";
import { getExternalWeeklyData } from "./external";
import { upsertCommercialPeriods, type CommercialPeriodInput } from "./commercial";
import { saveFunnelConfig } from "./funnel-config";

export const MARIA_MARIA_FUNNEL: FunnelConfig = {
  metaStages: [
    { key: "impressions", label: "Impressões" },
    { key: "clicks", label: "Cliques" },
    { key: "conversations", label: "Conversas iniciadas" },
  ],
  commercial: {
    periodColumn: "Semana",
    revenueColumn: "Total",
    ticketColumn: "TM",
    stages: [
      { key: "contatos", label: "Contatos WhatsApp", column: "Contatos Whatsapp" },
      { key: "agendamentos", label: "Agendamentos", column: "Agendamentos" },
      { key: "vendas", label: "Vendas", column: "Agendamentos com serviço" },
    ],
  },
};

function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export async function backfillCommercialFromExternal(
  db: D1Database,
  clientId: number,
): Promise<{ periods: number }> {
  const weeks = await getExternalWeeklyData(db, clientId);
  const periods: CommercialPeriodInput[] = weeks.map((w) => ({
    startDate: w.startDate,
    endDate: w.endDate,
    label: `${formatDayMonth(w.startDate)} a ${formatDayMonth(w.endDate)}`,
    row: {
      Semana: `${formatDayMonth(w.startDate)} a ${formatDayMonth(w.endDate)}`,
      "Contatos Whatsapp": String(w.contatosWhatsapp),
      Agendamentos: String(w.agendamentos),
      "Agendamentos com serviço": String(w.agendamentosComServico),
      TM: String(w.ticketMedio),
      Total: String(w.faturamento),
    },
  }));
  const saved = await upsertCommercialPeriods(db, clientId, periods);
  await saveFunnelConfig(db, clientId, MARIA_MARIA_FUNNEL);
  return { periods: saved };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- commercial-backfill` → PASS.

- [ ] **Step 5: Expor server function de backfill** em `api.ts` (para rodar sob demanda no cliente Maria Maria, já autenticado):

```ts
export const runCommercialBackfill = createServerFn({ method: "POST" })
  .validator((clientId: number) => clientId)
  .handler(async ({ data: clientId }) => {
    const { db } = await serverDeps();
    const { backfillCommercialFromExternal } = await import("./server/commercial-backfill");
    return backfillCommercialFromExternal(db, clientId);
  });
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/commercial-backfill.ts src/lib/api.ts test/commercial-backfill.test.ts
git commit -m "feat: backfill external_weekly_data -> commercial_periods + config Maria Maria"
```

---

### Task 7: UI — uploader de dados comerciais + tela de mapeamento

**Files:**
- Modify: rota de atualização do cliente (`src/routes/upload.$clientSlug.tsx` ou equivalente — confirmar com `Glob src/routes/**`)
- Create: `src/components/commercial/FunnelMappingForm.tsx`

**Interfaces:**
- Consumes: `fetchFunnelConfig`, `persistFunnelConfig`, `importCommercialCsv` (Task 5); `type FunnelConfig`; PapaParse.

- [ ] **Step 1: Confirmar a rota de upload** — `Glob src/routes/**/*upload*` e ler o componente para seguir o padrão visual (dark/dourado) e como o CSV do Meta já é lido com PapaParse.

- [ ] **Step 2: Componente de mapeamento** — `FunnelMappingForm.tsx`: recebe `headers: string[]` e `initial?: FunnelConfig`; renderiza, para cada coluna detectada, um `<select>` com opções: *Período*, *Faturamento*, *Ticket médio*, *Etapa (com campo de nome)*, *Ignorar*; permite ordenar etapas (ordem = ordem das colunas marcadas como etapa, de cima para baixo); botão "Salvar mapeamento" monta um `FunnelConfig` e chama `persistFunnelConfig`. Estilo dark/dourado consistente com os componentes existentes.

- [ ] **Step 3: Fluxo de upload comercial** — segundo dropzone "Dados comerciais (CSV)". Ao soltar o arquivo: PapaParse `header:true`; `fetchFunnelConfig(clientId)`:
  - sem config → mostrar `FunnelMappingForm` com os headers; após salvar, seguir para importar.
  - com config → mostrar resumo do mapeamento (com botão "ajustar mapeamento" que reabre o form) e importar direto.
  - Importar: `importCommercialCsv({ clientId, rows, refYear, fileName })` onde `refYear` = ano das datas do CSV do Meta já carregado, ou `new Date().getFullYear()`. Mostrar toast "N períodos salvos".

- [ ] **Step 4: Verificar tipos e build** — `npm run build` sem erros de tipo; `npm test` verde.

- [ ] **Step 5: Checkpoint do Thallys (localhost)** — rodar `npm run dev`; Thallys importa o CSV real da Maria Maria (`Espaço Maria Maria - Planilha de ganhos -ate 27-06.csv`), confere o mapeamento e que os períodos foram salvos, e que a tela atual da Maria Maria **continua idêntica**. Só depois:

- [ ] **Step 6: Commit**

```bash
git add src/routes src/components/commercial
git commit -m "feat: uploader comercial + tela de mapeamento de funil"
```

---

## Self-Review (feito)

- **Cobertura do spec:** modelo de dados (Task 1) · parsing BR+datas (Task 2) · config por cliente (Task 3) · commercial_periods idempotente (Task 4) · server functions + montagem de períodos (Task 5) · backfill sem perder dados + não dropar external_weekly_data (Task 6) · import+mapeamento UX (Task 7). Fora de escopo (funil visual, ROAS/CAC na tela, comparador) permanece fora — ok.
- **Placeholders:** nenhum; todo passo com código/comando concreto.
- **Consistência de tipos:** `FunnelConfig` definido na Task 2 e consumido igual nas Tasks 3/5/6/7; `CommercialPeriodInput` definido na Task 4 e reusado nas Tasks 5/6.
- **Risco conhecido:** Task 7 depende de confirmar o caminho real da rota de upload (Step 1) — resolvido em tempo de execução via Glob.
```
