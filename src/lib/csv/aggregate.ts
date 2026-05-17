import type { AdRow } from "./types";

export interface Aggregated {
  key: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  purchases: number;
  conversionValue: number;
  conversations: number;
  thruplays: number;
  videoPlays: number;
  video25: number;
  video50: number;
  video75: number;
  video95: number;
  engagement: number;
  // derivados
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  cpa: number;
  costPerResult: number;
  costPerConversation: number;
  costPerThruplay: number;
  frequency: number;
  rows: number;
}

export function aggregate(rows: AdRow[], dimension: keyof AdRow): Aggregated[] {
  const map = new Map<string, Aggregated>();
  for (const r of rows) {
    const key = String(r[dimension] ?? "—") || "—";
    let a = map.get(key);
    if (!a) {
      a = {
        key,
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        results: 0,
        purchases: 0,
        conversionValue: 0,
        conversations: 0,
        thruplays: 0,
        videoPlays: 0,
        video25: 0,
        video50: 0,
        video75: 0,
        video95: 0,
        engagement: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        roas: 0,
        cpa: 0,
        costPerResult: 0,
        costPerConversation: 0,
        costPerThruplay: 0,
        frequency: 0,
        rows: 0,
      };
      map.set(key, a);
    }
    a.spend += r.spend;
    a.impressions += r.impressions;
    a.reach += r.reach;
    a.clicks += r.clicks;
    a.results += r.results;
    a.purchases += r.purchases;
    a.conversionValue += r.conversionValue;
    a.conversations += r.conversations;
    a.thruplays += r.thruplays;
    a.videoPlays += r.videoPlays;
    a.video25 += r.video25;
    a.video50 += r.video50;
    a.video75 += r.video75;
    a.video95 += r.video95;
    a.engagement += r.engagement;
    a.rows += 1;
  }
  for (const a of map.values()) {
    a.ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
    a.cpc = a.clicks > 0 ? a.spend / a.clicks : 0;
    a.cpm = a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0;
    a.roas = a.spend > 0 ? a.conversionValue / a.spend : 0;
    a.cpa = a.purchases > 0 ? a.spend / a.purchases : 0;
    a.costPerResult = a.results > 0 ? a.spend / a.results : 0;
    a.costPerConversation = a.conversations > 0 ? a.spend / a.conversations : 0;
    a.costPerThruplay = a.thruplays > 0 ? a.spend / a.thruplays : 0;
    a.frequency = a.reach > 0 ? a.impressions / a.reach : 0;
    // Ticket médio dinâmico por linha agregada
    if (a.purchases > 0) a.conversionValue = a.conversionValue || 0; // Garantia de existência
  }
  return Array.from(map.values());
}

export interface Totals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  purchases: number;
  conversionValue: number;
  conversations: number;
  thruplays: number;
  videoPlays: number;
  video25: number;
  video50: number;
  video75: number;
  video95: number;
  engagement: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  cpa: number;
  costPerResult: number;
  costPerConversation: number;
  costPerThruplay: number;
  frequency: number;
  ticketMedio: number;
}

export function totals(rows: AdRow[]): Totals {
  const t: Totals = {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    results: 0,
    purchases: 0,
    conversionValue: 0,
    conversations: 0,
    thruplays: 0,
    videoPlays: 0,
    video25: 0,
    video50: 0,
    video75: 0,
    video95: 0,
    engagement: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    roas: 0,
    cpa: 0,
    costPerResult: 0,
    costPerConversation: 0,
    costPerThruplay: 0,
    frequency: 0,
    ticketMedio: 0,
  };
  for (const r of rows) {
    t.spend += r.spend;
    t.impressions += r.impressions;
    t.reach += r.reach;
    t.clicks += r.clicks;
    t.results += r.results;
    t.purchases += r.purchases;
    t.conversionValue += r.conversionValue;
    t.conversations += r.conversations;
    t.thruplays += r.thruplays;
    t.videoPlays += r.videoPlays;
    t.video25 += r.video25;
    t.video50 += r.video50;
    t.video75 += r.video75;
    t.video95 += r.video95;
    t.engagement += r.engagement;
  }
  t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
  t.cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
  t.cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0;
  t.roas = t.spend > 0 ? t.conversionValue / t.spend : 0;
  t.cpa = t.purchases > 0 ? t.spend / t.purchases : 0;
  t.costPerResult = t.results > 0 ? t.spend / t.results : 0;
  t.costPerConversation = t.conversations > 0 ? t.spend / t.conversations : 0;
  t.costPerThruplay = t.thruplays > 0 ? t.spend / t.thruplays : 0;
  t.frequency = t.reach > 0 ? t.impressions / t.reach : 0;
  t.ticketMedio = t.purchases > 0 ? t.conversionValue / t.purchases : 0;
  return t;
}

function parseDate(s: string): number {
  if (!s) return 0;
  // Tenta DD/MM/YYYY
  const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1])).getTime();
  }
  // Tenta YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3]),
    ).getTime();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export function timeSeries(rows: AdRow[]): {
  date: string;
  spend: number;
  results: number;
  clicks: number;
  impressions: number;
  conversionValue: number;
  conversations: number;
}[] {
  const map = new Map<
    string,
    {
      date: string;
      spend: number;
      results: number;
      clicks: number;
      impressions: number;
      conversionValue: number;
      conversations: number;
    }
  >();
  for (const r of rows) {
    if (!r.date) continue;
    let e = map.get(r.date);
    if (!e) {
      e = {
        date: r.date,
        spend: 0,
        results: 0,
        clicks: 0,
        impressions: 0,
        conversionValue: 0,
        conversations: 0,
      };
      map.set(r.date, e);
    }
    e.spend += r.spend;
    e.results += r.results;
    e.clicks += r.clicks;
    e.impressions += r.impressions;
    e.conversionValue += r.conversionValue;
    e.conversations += r.conversations;
  }
  return Array.from(map.values()).sort((a, b) => parseDate(a.date) - parseDate(b.date));
}
