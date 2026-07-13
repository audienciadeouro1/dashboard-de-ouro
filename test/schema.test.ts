import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema", () => {
  it("cria as tabelas atuais (leads removida na 0004 — escopo sem CRM)", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('clients','ad_daily_insights','external_weekly_data','csv_imports','leads') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "ad_daily_insights",
      "clients",
      "csv_imports",
      "external_weekly_data",
    ]);
  });
});

describe("schema comercial (migração 0008)", () => {
  it("cria funnel_configs com client_id único", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(funnel_configs)").all<{
      name: string;
    }>();
    const cols = results.map((r) => r.name);
    expect(cols).toEqual(expect.arrayContaining(["client_id", "config_json", "updated_at"]));
  });

  it("cria commercial_periods com colunas esperadas", async () => {
    const { results } = await env.DB.prepare("PRAGMA table_info(commercial_periods)").all<{
      name: string;
    }>();
    const cols = results.map((r) => r.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "client_id",
        "start_date",
        "end_date",
        "label",
        "row_json",
        "source",
        "created_at",
      ]),
    );
  });
});

describe("schema de diagnósticos (migração 0011)", () => {
  it("cria metas, diagnósticos e alertas", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('goals','diagnostics','alerts') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(["alerts", "diagnostics", "goals"]);
  });
});

describe("schema de memória estratégica (migração 0012)", () => {
  it("cria tarefas e decisões vinculadas ao cliente", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tasks','decisions') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((row) => row.name)).toEqual(["decisions", "tasks"]);
    const { results: taskColumns } = await env.DB.prepare("PRAGMA table_info(tasks)").all<{
      name: string;
    }>();
    expect(taskColumns.map((row) => row.name)).toEqual(
      expect.arrayContaining(["client_id", "origin_type", "status", "due_date"]),
    );
  });
});
