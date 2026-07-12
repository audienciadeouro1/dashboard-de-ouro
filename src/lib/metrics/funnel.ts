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
