# Fase 2C — Comparador de períodos

**Data:** 2026-07-12 · **Branch:** `v1.4-nova-fase-sistema` · Depende de 2B (funil + totais no servidor).

## Objetivo
Comparar dois períodos lado a lado (janela atual vs. anterior de mesmo tamanho), com variação % por métrica, reusando os cálculos determinísticos do servidor.

## Escopo
- Nova aba **"Comparar"** no dashboard do cliente.
- Presets: **7 dias**, **30 dias** (janela que termina na última data com dados vs. a janela anterior de mesmo tamanho) e **Personalizado** (usuário escolhe A; B = período imediatamente anterior, mesmo tamanho).
- Métricas comparadas: investimento, faturamento (funil.revenue), ROAS, CAC, impressões, cliques, conversas, compras, e as etapas do funil quando houver.
- Variação % = (A − B) / B (0 quando B = 0). Cada métrica sinaliza se "maior é melhor" (ex.: ROAS, faturamento) ou "menor é melhor" (ex.: CAC) para colorir.

## Arquitetura
- **Puro/testável** `src/lib/metrics/compare.ts`:
  - `type ComparePreset = "7d" | "30d" | "custom"`.
  - `interface Range { start: string; end: string }`
  - `computeComparePeriods(maxDate: string, preset: "7d" | "30d"): { a: Range; b: Range }` — janelas de 7/30 dias terminando em `maxDate`; `b` termina no dia anterior ao início de `a`.
  - `precedingRange(a: Range): Range` — período de mesmo tamanho imediatamente anterior a `a` (para o modo personalizado).
  - `pctChange(a: number, b: number): number` — `(a-b)/b`, 0 se `b<=0`.
- **Servidor** `src/lib/server/compare.ts`:
  - `getClientComparison(db, clientId, a: Range, b: Range)` → `{ a: { totals, funnel }, b: { totals, funnel } }` reusando `getClientTotals` e `getClientFunnel`.
- **Server function** `fetchClientComparison({ slug, a, b })` em `api.ts`.
- **UI** `src/components/dashboard/CompareTab.tsx`: seletor de preset + (no personalizado) `DateRangePicker` para A; tabela de métricas (A, B, Δ%). Aba adicionada em `dashboard.tsx`; alimentada com `maxDate` do dataset. Estilo dark/dourado.

## Datas
- `maxDate` = maior data com dados (do dataset já carregado). Aritmética em dias sobre `YYYY-MM-DD` (UTC, sem drift de fuso). Comparações de texto.

## Testes
- `computeComparePeriods`/`precedingRange`/`pctChange` (unit).
- `getClientComparison` (vitest-pool-workers): totais e funil de cada janela; isolamento por período.
- Manter os 66 testes atuais verdes.

## Fora de escopo
- Comparação de campanhas/anúncios individuais; mês-calendário exato (usamos janelas móveis). Diagnóstico automático das variações (Fase 3).
