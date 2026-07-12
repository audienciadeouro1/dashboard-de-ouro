# Fase 1a — D1, Clientes e Ingestão de CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Cloudflare D1 com schema completo, painel de clientes fixos como nova home, e upload de CSV que grava os dados no banco (mantendo o dashboard atual funcionando via store).

**Architecture:** Repositórios de dados são funções puras que recebem `D1Database` (testáveis via vitest-pool-workers). Server functions do TanStack Start expõem os repositórios ao frontend usando o binding `DB` via `cloudflare:workers`. A rota `/` vira o Painel de Clientes; o fluxo de upload atual move para `/upload/$clientSlug` e passa a persistir no D1 antes de navegar ao dashboard (que continua lendo do store em memória — a leitura do banco é Fase 1b).

**Tech Stack:** TanStack Start (React 19), Cloudflare Workers + D1, vitest + @cloudflare/vitest-pool-workers, shadcn/ui, PapaParse (existente).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-dashboard-de-ouro-v1.3-backend-design.md`
- Binding D1 chama-se `DB`; nome do banco: `dashboard-de-ouro`; conta Cloudflare `894017f8d5df2b9641112ff9d3fc2446`
- Perfis de dashboard (exatos): `pixel_sales`, `whatsapp_external`
- Status de leads (exatos): `qualificado`, `reuniao`, `proposta`, `fechado`, `perdido`
- Fontes de dados (exatas): `csv`, `meta_api`
- Anti-duplicação: chave única `(client_id, date, ad_key)` com upsert (dado novo substitui)
- Toda copy de UI em pt-BR
- Gerenciador de pacotes: `npm`
- O dashboard existente (`/dashboard`) NÃO muda nesta fase
- Clientes seed: Maria Maria (`maria-maria`, `whatsapp_external`) e Aki Sushi (`aki-sushi`, `pixel_sales`, conta Meta `1067373311996985`)

---

### Task 1: Infraestrutura de testes (vitest + pool-workers) e binding D1

**Files:**
- Modify: `wrangler.jsonc`
- Create: `vitest.config.ts`
- Create: `test/apply-migrations.ts`
- Create: `test/env.d.ts`
- Create: `migrations/0001_schema.sql`
- Create: `test/schema.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces: ambiente de teste com `env.DB` (D1 real via miniflare) e migrações aplicadas automaticamente; tabelas `clients`, `ad_daily_insights`, `external_weekly_data`, `leads`

- [ ] **Step 1: Instalar dependências de teste**

Run: `npm i -D vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types`
Expected: instalação sem erros.

- [ ] **Step 2: Criar o banco D1 remoto e configurar o binding**

Run: `npx wrangler d1 create dashboard-de-ouro`
Expected: saída com `database_id` (copiar o valor).

Atualizar `wrangler.jsonc` (substituir `<DATABASE_ID>` pelo id retornado):

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tanstack-start-app",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "dashboard-de-ouro",
      "database_id": "<DATABASE_ID>",
      "migrations_dir": "migrations"
    }
  ]
}
```

- [ ] **Step 3: Escrever a migração de schema**

`migrations/0001_schema.sql`:

```sql
-- Clientes fixos do gestor
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  color TEXT,
  meta_ad_account_id TEXT,
  dashboard_profile TEXT NOT NULL CHECK (dashboard_profile IN ('pixel_sales', 'whatsapp_external')),
  contract_start TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Matéria-prima: uma linha = cliente + dia + anúncio
CREATE TABLE ad_daily_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  ad_key TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT '',
  ad_set_name TEXT NOT NULL DEFAULT '',
  ad_name TEXT NOT NULL DEFAULT '',
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversations INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  conversion_value REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('csv', 'meta_api')),
  row_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (client_id, date, ad_key)
);
CREATE INDEX idx_insights_client_date ON ad_daily_insights (client_id, date);

-- Dados externos semanais (caso Maria Maria: planilha do salão)
CREATE TABLE external_weekly_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  contatos_whatsapp INTEGER NOT NULL DEFAULT 0,
  agendamentos INTEGER NOT NULL DEFAULT 0,
  agendamentos_com_servico INTEGER NOT NULL DEFAULT 0,
  faturamento REAL NOT NULL DEFAULT 0,
  ticket_medio REAL NOT NULL DEFAULT 0,
  UNIQUE (client_id, start_date)
);

-- Rastreamento de leads (tela nova na Fase 1b; schema pronto desde já)
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('qualificado', 'reuniao', 'proposta', 'fechado', 'perdido')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 4: Configurar vitest com pool-workers e migrações automáticas**

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
```

`test/apply-migrations.ts`:

```ts
import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

`test/env.d.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: D1Migration[];
  }
}
```

Adicionar em `package.json` (bloco `scripts`): `"test": "vitest run"`.

- [ ] **Step 5: Escrever teste de sanidade do schema**

`test/schema.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema", () => {
  it("cria as quatro tabelas", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('clients','ad_daily_insights','external_weekly_data','leads') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "ad_daily_insights",
      "clients",
      "external_weekly_data",
      "leads",
    ]);
  });
});
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test`
Expected: PASS (1 teste).

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc vitest.config.ts test/ migrations/ package.json package-lock.json
git commit -m "feat: D1 binding, schema inicial e infraestrutura de testes (vitest-pool-workers)"
```

---

### Task 2: Repositório de clientes (CRUD)

**Files:**
- Create: `src/lib/server/clients.ts`
- Test: `test/clients.test.ts`

**Interfaces:**
- Consumes: tabelas da Task 1
- Produces:
  - `interface Client { id: number; name: string; slug: string; logoUrl: string | null; color: string | null; metaAdAccountId: string | null; dashboardProfile: "pixel_sales" | "whatsapp_external"; contractStart: string | null; lastSyncedAt: string | null; createdAt: string }`
  - `interface ClientInput { name: string; slug: string; dashboardProfile: Client["dashboardProfile"]; logoUrl?: string | null; color?: string | null; metaAdAccountId?: string | null; contractStart?: string | null }`
  - `listClients(db: D1Database): Promise<Client[]>`
  - `getClientBySlug(db: D1Database, slug: string): Promise<Client | null>`
  - `createClient(db: D1Database, input: ClientInput): Promise<Client>`
  - `updateClient(db: D1Database, id: number, input: Partial<ClientInput>): Promise<Client>`
  - `touchLastSynced(db: D1Database, id: number): Promise<void>`

- [ ] **Step 1: Escrever os testes que falham**

`test/clients.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  listClients,
  getClientBySlug,
  createClient,
  updateClient,
  touchLastSynced,
} from "../src/lib/server/clients";

describe("clients repo", () => {
  it("cria e lista clientes", async () => {
    await createClient(env.DB, {
      name: "Aki Sushi",
      slug: "aki-sushi",
      dashboardProfile: "pixel_sales",
      metaAdAccountId: "1067373311996985",
    });
    const all = await listClients(env.DB);
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Aki Sushi");
    expect(all[0].dashboardProfile).toBe("pixel_sales");
    expect(all[0].metaAdAccountId).toBe("1067373311996985");
    expect(all[0].lastSyncedAt).toBeNull();
  });

  it("busca por slug e retorna null quando não existe", async () => {
    await createClient(env.DB, {
      name: "Maria Maria",
      slug: "maria-maria",
      dashboardProfile: "whatsapp_external",
    });
    const found = await getClientBySlug(env.DB, "maria-maria");
    expect(found?.name).toBe("Maria Maria");
    expect(await getClientBySlug(env.DB, "nao-existe")).toBeNull();
  });

  it("rejeita slug duplicado", async () => {
    await createClient(env.DB, { name: "A", slug: "dup", dashboardProfile: "pixel_sales" });
    await expect(
      createClient(env.DB, { name: "B", slug: "dup", dashboardProfile: "pixel_sales" }),
    ).rejects.toThrow();
  });

  it("atualiza cliente e marca sincronização", async () => {
    const c = await createClient(env.DB, {
      name: "A",
      slug: "a",
      dashboardProfile: "pixel_sales",
    });
    const updated = await updateClient(env.DB, c.id, { name: "A2", color: "#FFD700" });
    expect(updated.name).toBe("A2");
    expect(updated.color).toBe("#FFD700");
    await touchLastSynced(env.DB, c.id);
    const after = await getClientBySlug(env.DB, "a");
    expect(after?.lastSyncedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo `src/lib/server/clients` não existe.

- [ ] **Step 3: Implementar o repositório**

`src/lib/server/clients.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";

export type DashboardProfile = "pixel_sales" | "whatsapp_external";

export interface Client {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  color: string | null;
  metaAdAccountId: string | null;
  dashboardProfile: DashboardProfile;
  contractStart: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface ClientInput {
  name: string;
  slug: string;
  dashboardProfile: DashboardProfile;
  logoUrl?: string | null;
  color?: string | null;
  metaAdAccountId?: string | null;
  contractStart?: string | null;
}

interface ClientRow {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  color: string | null;
  meta_ad_account_id: string | null;
  dashboard_profile: DashboardProfile;
  contract_start: string | null;
  last_synced_at: string | null;
  created_at: string;
}

function toClient(r: ClientRow): Client {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    logoUrl: r.logo_url,
    color: r.color,
    metaAdAccountId: r.meta_ad_account_id,
    dashboardProfile: r.dashboard_profile,
    contractStart: r.contract_start,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
  };
}

const COLS =
  "id, name, slug, logo_url, color, meta_ad_account_id, dashboard_profile, contract_start, last_synced_at, created_at";

export async function listClients(db: D1Database): Promise<Client[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM clients ORDER BY name`)
    .all<ClientRow>();
  return results.map(toClient);
}

export async function getClientBySlug(db: D1Database, slug: string): Promise<Client | null> {
  const row = await db
    .prepare(`SELECT ${COLS} FROM clients WHERE slug = ?`)
    .bind(slug)
    .first<ClientRow>();
  return row ? toClient(row) : null;
}

export async function createClient(db: D1Database, input: ClientInput): Promise<Client> {
  const row = await db
    .prepare(
      `INSERT INTO clients (name, slug, logo_url, color, meta_ad_account_id, dashboard_profile, contract_start)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING ${COLS}`,
    )
    .bind(
      input.name,
      input.slug,
      input.logoUrl ?? null,
      input.color ?? null,
      input.metaAdAccountId ?? null,
      input.dashboardProfile,
      input.contractStart ?? null,
    )
    .first<ClientRow>();
  if (!row) throw new Error("Falha ao criar cliente.");
  return toClient(row);
}

export async function updateClient(
  db: D1Database,
  id: number,
  input: Partial<ClientInput>,
): Promise<Client> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  const map: Record<string, string> = {
    name: "name",
    slug: "slug",
    logoUrl: "logo_url",
    color: "color",
    metaAdAccountId: "meta_ad_account_id",
    dashboardProfile: "dashboard_profile",
    contractStart: "contract_start",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) {
      sets.push(`${col} = ?`);
      binds.push((input as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) throw new Error("Nada para atualizar.");
  const row = await db
    .prepare(`UPDATE clients SET ${sets.join(", ")} WHERE id = ? RETURNING ${COLS}`)
    .bind(...binds, id)
    .first<ClientRow>();
  if (!row) throw new Error("Cliente não encontrado.");
  return toClient(row);
}

export async function touchLastSynced(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE clients SET last_synced_at = datetime('now') WHERE id = ?").bind(id).run();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/clients.ts test/clients.test.ts
git commit -m "feat: repositório de clientes (CRUD) com testes"
```

---

### Task 3: Repositório de insights diários (upsert anti-duplicação)

**Files:**
- Create: `src/lib/server/insights.ts`
- Test: `test/insights.test.ts`

**Interfaces:**
- Consumes: `AdRow` de `src/lib/csv/types.ts`; `createClient` da Task 2 (nos testes)
- Produces:
  - `adKeyFor(row: AdRow): string` — `"${campaignName}|${adSetName}|${adName}"`
  - `upsertInsights(db: D1Database, clientId: number, rows: AdRow[], source: "csv" | "meta_api"): Promise<number>` — retorna nº de linhas gravadas
  - `getInsights(db: D1Database, clientId: number, range?: { start?: string; end?: string }): Promise<AdRow[]>` — reconstrói `AdRow` a partir de `row_json`
  - `getDataRange(db: D1Database, clientId: number): Promise<{ minDate: string; maxDate: string } | null>`

- [ ] **Step 1: Escrever os testes que falham**

`test/insights.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "../src/lib/server/clients";
import { upsertInsights, getInsights, getDataRange, adKeyFor } from "../src/lib/server/insights";
import type { AdRow } from "../src/lib/csv/types";

function makeRow(overrides: Partial<AdRow> = {}): AdRow {
  return {
    campaignName: "Campanha A",
    adSetName: "Conjunto 1",
    adName: "Anúncio X",
    date: "2026-07-01",
    endDate: "2026-07-01",
    objective: "",
    delivery: "",
    budget: 0,
    budgetType: "",
    attribution: "",
    spend: 100,
    impressions: 1000,
    reach: 800,
    frequency: 1.25,
    clicks: 50,
    ctr: 5,
    cpc: 2,
    cpm: 100,
    results: 10,
    resultIndicator: "",
    resultUnit: "",
    costPerResult: 10,
    purchases: 3,
    cpa: 33.3,
    conversionValue: 500,
    averageConversionValue: 166.7,
    roas: 5,
    conversations: 8,
    costPerConversation: 12.5,
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
    ctrTodos: 0,
    rawData: { "Nome da campanha": "Campanha A" },
    ...overrides,
  };
}

describe("insights repo", () => {
  let clientId: number;

  beforeEach(async () => {
    const c = await createClient(env.DB, {
      name: `C${Date.now()}${Math.random()}`,
      slug: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dashboardProfile: "pixel_sales",
    });
    clientId = c.id;
  });

  it("grava e reconstrói AdRow completo (roundtrip)", async () => {
    const row = makeRow();
    const n = await upsertInsights(env.DB, clientId, [row], "csv");
    expect(n).toBe(1);
    const rows = await getInsights(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(row);
  });

  it("mesmo CSV duas vezes não duplica", async () => {
    const rows = [makeRow(), makeRow({ adName: "Anúncio Y" })];
    await upsertInsights(env.DB, clientId, rows, "csv");
    await upsertInsights(env.DB, clientId, rows, "csv");
    expect(await getInsights(env.DB, clientId)).toHaveLength(2);
  });

  it("dado novo para o mesmo endereço substitui o antigo (Meta refina retroativamente)", async () => {
    await upsertInsights(env.DB, clientId, [makeRow({ spend: 100 })], "csv");
    await upsertInsights(env.DB, clientId, [makeRow({ spend: 120 })], "meta_api");
    const rows = await getInsights(env.DB, clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0].spend).toBe(120);
  });

  it("filtra por período", async () => {
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
    const july = await getInsights(env.DB, clientId, { start: "2026-07-01", end: "2026-07-31" });
    expect(july.map((r) => r.date).sort()).toEqual(["2026-07-01", "2026-07-20"]);
  });

  it("retorna intervalo de dados disponível", async () => {
    expect(await getDataRange(env.DB, clientId)).toBeNull();
    await upsertInsights(
      env.DB,
      clientId,
      [makeRow({ date: "2026-06-15" }), makeRow({ date: "2026-07-20" })],
      "csv",
    );
    expect(await getDataRange(env.DB, clientId)).toEqual({
      minDate: "2026-06-15",
      maxDate: "2026-07-20",
    });
  });

  it("adKeyFor compõe campanha|conjunto|anúncio", () => {
    expect(adKeyFor(makeRow())).toBe("Campanha A|Conjunto 1|Anúncio X");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulo `src/lib/server/insights` não existe.

- [ ] **Step 3: Implementar o repositório**

`src/lib/server/insights.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";
import type { AdRow } from "../csv/types";

export type InsightSource = "csv" | "meta_api";

export function adKeyFor(row: AdRow): string {
  return `${row.campaignName}|${row.adSetName}|${row.adName}`;
}

const UPSERT = `
INSERT INTO ad_daily_insights (
  client_id, date, ad_key, campaign_name, ad_set_name, ad_name,
  spend, impressions, conversations, purchases, conversion_value,
  source, row_json, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT (client_id, date, ad_key) DO UPDATE SET
  campaign_name = excluded.campaign_name,
  ad_set_name = excluded.ad_set_name,
  ad_name = excluded.ad_name,
  spend = excluded.spend,
  impressions = excluded.impressions,
  conversations = excluded.conversations,
  purchases = excluded.purchases,
  conversion_value = excluded.conversion_value,
  source = excluded.source,
  row_json = excluded.row_json,
  updated_at = excluded.updated_at
`;

export async function upsertInsights(
  db: D1Database,
  clientId: number,
  rows: AdRow[],
  source: InsightSource,
): Promise<number> {
  if (rows.length === 0) return 0;
  const stmt = db.prepare(UPSERT);
  // D1 batch é atômico: ou grava tudo, ou nada (erro no meio não corrompe)
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await db.batch(
      chunk.map((r) =>
        stmt.bind(
          clientId,
          r.date,
          adKeyFor(r),
          r.campaignName,
          r.adSetName,
          r.adName,
          r.spend,
          r.impressions,
          r.conversations,
          r.purchases,
          r.conversionValue,
          source,
          JSON.stringify(r),
        ),
      ),
    );
  }
  return rows.length;
}

export async function getInsights(
  db: D1Database,
  clientId: number,
  range?: { start?: string; end?: string },
): Promise<AdRow[]> {
  let sql = "SELECT row_json FROM ad_daily_insights WHERE client_id = ?";
  const binds: unknown[] = [clientId];
  if (range?.start) {
    sql += " AND date >= ?";
    binds.push(range.start);
  }
  if (range?.end) {
    sql += " AND date <= ?";
    binds.push(range.end);
  }
  sql += " ORDER BY date, ad_key";
  const { results } = await db
    .prepare(sql)
    .bind(...binds)
    .all<{ row_json: string }>();
  return results.map((r) => JSON.parse(r.row_json) as AdRow);
}

export async function getDataRange(
  db: D1Database,
  clientId: number,
): Promise<{ minDate: string; maxDate: string } | null> {
  const row = await db
    .prepare(
      "SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM ad_daily_insights WHERE client_id = ?",
    )
    .bind(clientId)
    .first<{ minDate: string | null; maxDate: string | null }>();
  if (!row || row.minDate === null || row.maxDate === null) return null;
  return { minDate: row.minDate, maxDate: row.maxDate };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/insights.ts test/insights.test.ts
git commit -m "feat: repositório de insights diários com upsert anti-duplicação"
```

---

### Task 4: Seed dos clientes iniciais + server functions

**Files:**
- Create: `migrations/0002_seed_clients.sql`
- Create: `src/lib/server/api.ts`
- Test: `test/seed.test.ts`

**Interfaces:**
- Consumes: repositórios das Tasks 2–3; binding `DB` via `cloudflare:workers`
- Produces (server functions consumidas pelas rotas nas Tasks 5–6):
  - `fetchClients(): Promise<Client[]>`
  - `fetchClientBySlug({ data: string }): Promise<Client | null>`
  - `addClient({ data: ClientInput }): Promise<Client>`
  - `ingestCsvRows({ data: { clientId: number; rows: AdRow[] } }): Promise<{ saved: number }>` — grava com `source: "csv"` e atualiza `last_synced_at`

- [ ] **Step 1: Escrever a migração de seed**

`migrations/0002_seed_clients.sql`:

```sql
INSERT INTO clients (name, slug, dashboard_profile, meta_ad_account_id) VALUES
  ('Maria Maria', 'maria-maria', 'whatsapp_external', NULL),
  ('Aki Sushi', 'aki-sushi', 'pixel_sales', '1067373311996985');
```

- [ ] **Step 2: Escrever teste do seed (falha antes da migração existir)**

`test/seed.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getClientBySlug } from "../src/lib/server/clients";

describe("seed", () => {
  it("Maria Maria e Aki Sushi existem com perfis corretos", async () => {
    const mm = await getClientBySlug(env.DB, "maria-maria");
    const aki = await getClientBySlug(env.DB, "aki-sushi");
    expect(mm?.dashboardProfile).toBe("whatsapp_external");
    expect(aki?.dashboardProfile).toBe("pixel_sales");
    expect(aki?.metaAdAccountId).toBe("1067373311996985");
  });
});
```

Nota: os testes das Tasks 2–3 criam clientes próprios com slugs aleatórios, então o seed não os quebra.

- [ ] **Step 3: Rodar testes**

Run: `npm test`
Expected: PASS (o setup aplica todas as migrações, incluindo o seed).

- [ ] **Step 4: Implementar as server functions**

`src/lib/server/api.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import type { D1Database } from "@cloudflare/workers-types";
import {
  listClients,
  getClientBySlug,
  createClient,
  touchLastSynced,
  type Client,
  type ClientInput,
} from "./clients";
import { upsertInsights } from "./insights";
import type { AdRow } from "../csv/types";

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

export const fetchClients = createServerFn({ method: "GET" }).handler(
  async (): Promise<Client[]> => listClients(db()),
);

export const fetchClientBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data }): Promise<Client | null> => getClientBySlug(db(), data));

export const addClient = createServerFn({ method: "POST" })
  .validator((input: ClientInput) => input)
  .handler(async ({ data }): Promise<Client> => createClient(db(), data));

export const ingestCsvRows = createServerFn({ method: "POST" })
  .validator((input: { clientId: number; rows: AdRow[] }) => input)
  .handler(async ({ data }): Promise<{ saved: number }> => {
    const saved = await upsertInsights(db(), data.clientId, data.rows, "csv");
    await touchLastSynced(db(), data.clientId);
    return { saved };
  });
```

Nota para o executor: se a versão instalada de `@tanstack/react-start` usar `.inputValidator()` em vez de `.validator()`, adapte — verifique com `grep -r "createServerFn" node_modules/@tanstack/react-start/dist/esm/*.d.ts | head`.

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add migrations/0002_seed_clients.sql src/lib/server/api.ts test/seed.test.ts
git commit -m "feat: seed Maria Maria e Aki Sushi + server functions de clientes e ingestão"
```

---

### Task 5: Painel de Clientes (nova home `/`)

**Files:**
- Modify: `src/routes/index.tsx` (substituição completa — o conteúdo atual de upload move para a Task 6)
- Create: `src/components/ClientCard.tsx`
- Create: `src/components/NewClientDialog.tsx`

**Interfaces:**
- Consumes: `fetchClients`, `addClient` da Task 4; `Client` da Task 2; shadcn `Button`, `Dialog`, `Input`, `Label`, `Select`; `BrandHeader` existente
- Produces: rota `/` renderiza cards de todos os clientes; clique navega para `/upload/$clientSlug` (criada na Task 6)

- [ ] **Step 1: Criar o ClientCard**

`src/components/ClientCard.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import type { Client } from "@/lib/server/clients";
import { cn } from "@/lib/utils";

const PROFILE_LABELS: Record<Client["dashboardProfile"], string> = {
  pixel_sales: "Vendas via Pixel",
  whatsapp_external: "WhatsApp + Dados Externos",
};

function formatDate(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const last = new Date(lastSyncedAt.replace(" ", "T") + "Z").getTime();
  return Date.now() - last > 7 * 24 * 3600 * 1000;
}

export function ClientCard({ client }: { client: Client }) {
  const stale = isStale(client.lastSyncedAt);
  return (
    <Link
      to="/upload/$clientSlug"
      params={{ clientSlug: client.slug }}
      className={cn(
        "glass-card rounded-xl p-6 flex flex-col gap-3 transition-transform hover:scale-[1.02]",
        "border",
        stale ? "border-[oklch(0.78_0.16_60_/_0.4)]" : "border-[oklch(0.83_0.16_88_/_0.2)]",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">{client.name}</h3>
        {stale && <AlertTriangle className="w-4 h-4 text-[oklch(0.85_0.16_60)]" />}
      </div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {PROFILE_LABELS[client.dashboardProfile]}
      </p>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarCheck className="w-4 h-4" />
        {client.lastSyncedAt
          ? `Dados até ${formatDate(client.lastSyncedAt)}`
          : "Sem dados ainda"}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Criar o NewClientDialog**

`src/components/NewClientDialog.tsx`:

```tsx
import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addClient } from "@/lib/server/api";
import type { DashboardProfile } from "@/lib/server/clients";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function NewClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<DashboardProfile>("pixel_sales");
  const [metaAccountId, setMetaAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addClient({
        data: {
          name: name.trim(),
          slug: slugify(name),
          dashboardProfile: profile,
          metaAdAccountId: metaAccountId.trim() || null,
        },
      });
      setOpen(false);
      setName("");
      setMetaAccountId("");
      router.invalidate();
    } catch {
      setError("Erro ao salvar. O nome pode já estar em uso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" /> Novo cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client-name">Nome</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aki Sushi"
            />
          </div>
          <div className="space-y-2">
            <Label>Perfil do dashboard</Label>
            <Select value={profile} onValueChange={(v) => setProfile(v as DashboardProfile)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pixel_sales">Vendas via Pixel</SelectItem>
                <SelectItem value="whatsapp_external">WhatsApp + Dados Externos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-account">Conta de anúncio Meta (opcional)</Label>
            <Input
              id="meta-account"
              value={metaAccountId}
              onChange={(e) => setMetaAccountId(e.target.value)}
              placeholder="Ex: 1067373311996985"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar cliente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Substituir a home pelo painel**

`src/routes/index.tsx` (conteúdo completo novo — o upload atual será recriado na Task 6 em `/upload/$clientSlug`):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { BrandHeader } from "@/components/BrandHeader";
import { ClientCard } from "@/components/ClientCard";
import { NewClientDialog } from "@/components/NewClientDialog";
import { fetchClients } from "@/lib/server/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard de Ouro — Painel de Clientes" },
      {
        name: "description",
        content: "Painel do gestor: clientes, histórico e dashboards de tráfego pago.",
      },
    ],
  }),
  loader: () => fetchClients(),
  component: ClientsPanel,
});

function ClientsPanel() {
  const clients = Route.useLoaderData();
  return (
    <div className="min-h-screen">
      <BrandHeader />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel de Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione um cliente para atualizar dados e abrir o dashboard.
            </p>
          </div>
          <NewClientDialog />
        </div>
        {clients.length === 0 ? (
          <p className="text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

Nota: `BrandHeader` — verificar a assinatura das props no arquivo existente (`src/components/BrandHeader.tsx`) e ajustar a chamada se receber props obrigatórias.

- [ ] **Step 4: Verificar em dev**

Run: `npm run dev` e abrir `http://localhost:8080/` (ou porta indicada).
Expected: painel com os cards "Maria Maria" e "Aki Sushi" (seed local: rodar antes `npx wrangler d1 migrations apply dashboard-de-ouro --local` se o dev server não aplicar automaticamente). Criar um cliente de teste pelo dialog e vê-lo aparecer.

Nota: o link do card aponta para `/upload/$clientSlug`, que só existirá na Task 6 — erro de navegação aqui é esperado e aceitável neste passo (o TypeScript pode acusar rota inexistente; nesse caso, conclua a Task 6 antes de rodar `npm run build`).

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx src/components/ClientCard.tsx src/components/NewClientDialog.tsx
git commit -m "feat: painel de clientes como nova home"
```

---

### Task 6: Upload por cliente gravando no banco

**Files:**
- Create: `src/routes/upload.$clientSlug.tsx`
- Reference (copiar estrutura de): versão anterior de `src/routes/index.tsx` (disponível em `git show HEAD~1:src/routes/index.tsx` após a Task 5)

**Interfaces:**
- Consumes: `fetchClientBySlug`, `ingestCsvRows` (Task 4); `parseCsvFile` (`src/lib/csv/parser.ts`); `processMariaMaria` (`src/lib/csv/maria-maria.ts`); `setData` (`src/lib/store.ts`); `UploadDropzone`, `BrandHeader` existentes
- Produces: rota `/upload/$clientSlug` — sobe CSV, persiste no D1 via `ingestCsvRows`, alimenta o store e navega para `/dashboard` (dashboard inalterado)

- [ ] **Step 1: Criar a rota de upload por cliente**

`src/routes/upload.$clientSlug.tsx` — adaptação da antiga home. Estrutura completa:

```tsx
import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BrandHeader } from "@/components/BrandHeader";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCsvFile } from "@/lib/csv/parser";
import type { AnalysisMode, ParsedDataset } from "@/lib/csv/types";
import { processMariaMaria } from "@/lib/csv/maria-maria";
import { setData } from "@/lib/store";
import { fetchClientBySlug, ingestCsvRows } from "@/lib/server/api";

export const Route = createFileRoute("/upload/$clientSlug")({
  loader: async ({ params }) => {
    const client = await fetchClientBySlug({ data: params.clientSlug });
    if (!client) throw notFound();
    return client;
  },
  component: UploadPage,
});

function UploadPage() {
  const client = Route.useLoaderData();
  const navigate = useNavigate();
  const [fileA, setFileA] = useState<File | null>(null); // Meta Ads
  const [fileB, setFileB] = useState<File | null>(null); // Salão (Maria Maria)
  const [parsed, setParsed] = useState<ParsedDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("");

  // Modo derivado do perfil do cliente
  const mode: AnalysisMode =
    client.slug === "maria-maria"
      ? "maria-maria"
      : client.dashboardProfile === "pixel_sales"
        ? "sales"
        : "leads";
  const isMariaMaria = mode === "maria-maria";

  async function handleFileA(f: File) {
    setError(null);
    setLoading(true);
    setFileA(f);
    try {
      const result = await parseCsvFile(f);
      if (result.totalRows === 0) {
        throw new Error("O CSV do Meta não contém linhas de dados.");
      }
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar o arquivo.");
      setFileA(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!parsed) return;
    setLoading(true);
    setError(null);
    try {
      // Persiste no banco ANTES de navegar (fonte da verdade)
      await ingestCsvRows({ data: { clientId: client.id, rows: parsed.rows } });

      let finalDataset = parsed;
      if (isMariaMaria) {
        if (!fileB) {
          setError("Para Maria Maria, é necessário subir o arquivo do Salão também.");
          setLoading(false);
          return;
        }
        const mmDataset = await processMariaMaria(parsed, fileB);
        finalDataset = { ...parsed, mariaMaria: mmDataset };
      }
      setData(finalDataset, { clientName: client.name, period, mode });
      navigate({ to: "/dashboard" });
    } catch (e) {
      setError(
        e instanceof Error
          ? `Erro ao salvar os dados: ${e.message}`
          : "Erro ao salvar os dados no banco.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <BrandHeader />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Atualizar dados — {client.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suba o CSV exportado do Meta Ads. Os dados são salvos e somados ao histórico — dias
            repetidos são substituídos pela versão mais recente, nunca duplicados.
          </p>
        </div>

        <div className="space-y-4">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            CSV do Meta Ads
          </Label>
          <UploadDropzone onFile={handleFileA} file={fileA} loading={loading} />
          {isMariaMaria && (
            <>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                CSV do Salão (Maria Maria)
              </Label>
              <UploadDropzone onFile={setFileB} file={fileB} loading={false} />
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="period" className="text-xs uppercase tracking-wider text-muted-foreground">
            Período do relatório (opcional)
          </Label>
          <Input
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Ex: 01/07 a 31/07"
          />
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!parsed || loading}
          className="w-full gap-2"
          size="lg"
        >
          {loading ? "Processando..." : "Salvar e abrir dashboard"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </main>
    </div>
  );
}
```

Nota: `UploadDropzone` — verificar as props reais no arquivo existente (`src/components/UploadDropzone.tsx`) e ajustar (`onFile`/`file`/`loading` podem ter nomes diferentes). O mesmo vale para `BrandHeader`.

- [ ] **Step 2: Verificar fluxo completo em dev**

Run: `npm run dev`
Expected:
1. Painel `/` → clicar em "Aki Sushi" → página de upload abre com o nome do cliente
2. Subir um CSV real do Meta Ads → "Salvar e abrir dashboard" → dashboard renderiza como antes
3. Voltar ao painel → card do Aki Sushi mostra "Dados até (hoje)" sem o alerta ⚠️
4. Verificar persistência: `npx wrangler d1 execute dashboard-de-ouro --local --command "SELECT COUNT(*) AS n, MIN(date), MAX(date) FROM ad_daily_insights"` → contagem igual ao nº de linhas do CSV
5. Subir o MESMO CSV de novo → contagem não muda (anti-duplicação funcionando de ponta a ponta)

- [ ] **Step 3: Rodar testes e build**

Run: `npm test && npm run build`
Expected: testes PASS, build sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/routes/upload.\$clientSlug.tsx src/routeTree.gen.ts
git commit -m "feat: upload por cliente com persistência no D1"
```

---

### Task 7: Migrações remotas e deploy

**Files:**
- Nenhum arquivo novo — operações de infra

**Interfaces:**
- Consumes: tudo das tasks anteriores
- Produces: sistema no ar com D1 populado (seed) em produção

- [ ] **Step 1: Aplicar migrações no banco remoto**

Run: `npx wrangler d1 migrations apply dashboard-de-ouro --remote`
Expected: `0001_schema.sql` e `0002_seed_clients.sql` aplicadas com sucesso.

- [ ] **Step 2: Build e deploy**

Run: `npm run build && npx wrangler deploy`
Expected: deploy sem erros; URL do Worker na saída.

- [ ] **Step 3: Smoke test em produção**

Abrir a URL do Worker: painel mostra Maria Maria e Aki Sushi. Subir um CSV pelo fluxo do Aki Sushi e conferir o dashboard.

Run: `npx wrangler d1 execute dashboard-de-ouro --remote --command "SELECT c.name, COUNT(i.id) AS linhas FROM clients c LEFT JOIN ad_daily_insights i ON i.client_id = c.id GROUP BY c.id"`
Expected: contagem > 0 para o cliente testado.

- [ ] **Step 4: Commit final e atualização da nota Obsidian**

```bash
git add -A
git commit -m "chore: fase 1a concluída — D1, painel de clientes e ingestão de CSV"
git push origin v1.3-backend
```

Atualizar o log de sessões em `C:\GitHub\audiencia-brain\wiki\areas\audiencia-de-ouro\dashboard-de-ouro.md` (obrigatório pelo CLAUDE.md).
