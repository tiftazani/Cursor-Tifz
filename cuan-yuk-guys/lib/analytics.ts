import type { AnalyticsPayload, Bar, ScoredStock, TrackPoint } from "./types";
import { mean, pctChange } from "./indicators";
import { prepareStock, scoreUniverse } from "./scoring/stocks";

export function buildAnalytics(
  stocks: ScoredStock[],
  ihsg: Bar[],
  slicedScore: (endExclusive: number) => ScoredStock[],
): AnalyticsPayload {
  const ihsgSeries = ihsg.map((b) => ({ date: b.date, value: b.close }));
  const startIhsg = ihsg[0]?.close ?? 1;
  const drawdown: { date: string; dd: number }[] = [];
  let peak = startIhsg;
  for (const b of ihsg) {
    if (b.close > peak) peak = b.close;
    drawdown.push({ date: b.date, dd: peak ? b.close / peak - 1 : 0 });
  }

  const sectorMap = new Map<string, { change: number; score: number; n: number }>();
  for (const s of stocks) {
    const row = sectorMap.get(s.sector) ?? { change: 0, score: 0, n: 0 };
    row.change += s.changePct;
    row.score += s.score;
    row.n += 1;
    sectorMap.set(s.sector, row);
  }
  const sectorHeatmap = [...sectorMap.entries()]
    .map(([sector, v]) => ({
      sector,
      changePct: v.change / v.n,
      avgScore: v.score / v.n,
      count: v.n,
    }))
    .sort((a, b) => b.changePct - a.changePct);

  const scatter = stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    vol: s.volatility,
    ret1m: s.ret1m,
    score: s.score,
    sector: s.sector,
  }));

  const buckets = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  const scoreBuckets = buckets.map((bucket) => {
    const [lo, hi] = bucket.split("-").map(Number);
    return { bucket, count: stocks.filter((s) => s.score >= lo && s.score < hi + (hi === 100 ? 1 : 0)).length };
  });

  const trackRecord = walkForward(ihsg, slicedScore);
  const hits = trackRecord.filter((t) => t.hit).length;
  const alphas5 = trackRecord.map((t) => t.alpha5d).filter((v): v is number => v != null);
  const picksSeries = compoundPicks(ihsg, trackRecord);

  const last30p = picksSeries.slice(-21);
  const picksVsIhsg30d =
    last30p.length > 1
      ? (last30p[last30p.length - 1].picks / last30p[0].picks - 1) -
        (last30p[last30p.length - 1].ihsg / last30p[0].ihsg - 1)
      : 0;

  return {
    ihsgSeries,
    picksSeries,
    drawdown,
    sectorHeatmap,
    scatter,
    scoreBuckets,
    trackRecord,
    summary: {
      hitRate: trackRecord.length ? hits / trackRecord.length : 0,
      avgAlpha1d: mean(trackRecord.map((t) => t.alpha1d)),
      avgAlpha5d: alphas5.length ? mean(alphas5) : 0,
      picksVsIhsg30d,
    },
  };
}

function walkForward(ihsg: Bar[], slicedScore: (endExclusive: number) => ScoredStock[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  const start = Math.max(80, ihsg.length - 25);
  for (let i = start; i < ihsg.length - 1; i += 1) {
    const ranked = slicedScore(i + 1);
    const picks = ranked.slice(0, 5);
    const tickers = picks.map((p) => p.ticker);
    const next = ihsg[i + 1];
    const today = ihsg[i];
    const pickRet1d = mean(
      picks.map((p) => {
        const bars = p.bars;
        const a = bars.find((b) => b.date === today.date);
        const b = bars.find((x) => x.date === next.date);
        if (!a || !b) return 0;
        return pctChange(a.close, b.close);
      }),
    );
    const ihsgRet1d = pctChange(today.close, next.close);
    let pickRet5d: number | null = null;
    let ihsgRet5d: number | null = null;
    let alpha5d: number | null = null;
    if (i + 5 < ihsg.length) {
      const later = ihsg[i + 5];
      pickRet5d = mean(
        picks.map((p) => {
          const a = p.bars.find((b) => b.date === today.date);
          const b = p.bars.find((x) => x.date === later.date);
          if (!a || !b) return 0;
          return pctChange(a.close, b.close);
        }),
      );
      ihsgRet5d = pctChange(today.close, later.close);
      alpha5d = pickRet5d - ihsgRet5d;
    }
    out.push({
      date: today.date,
      tickers,
      pickRet1d,
      ihsgRet1d,
      alpha1d: pickRet1d - ihsgRet1d,
      pickRet5d,
      ihsgRet5d,
      alpha5d,
      hit: pickRet1d - ihsgRet1d > 0,
    });
  }
  return out;
}

function compoundPicks(ihsg: Bar[], track: TrackPoint[]): { date: string; picks: number; ihsg: number }[] {
  if (!ihsg.length) return [];
  const byDate = new Map(track.map((t) => [t.date, t]));
  let picksNav = 100;
  let ihsgNav = 100;
  const out: { date: string; picks: number; ihsg: number }[] = [];
  for (let i = 0; i < ihsg.length; i += 1) {
    const prev = ihsg[i - 1];
    if (prev) {
      const t = byDate.get(prev.date);
      if (t) {
        picksNav *= 1 + t.pickRet1d;
        ihsgNav *= 1 + t.ihsgRet1d;
      } else if (i > 0) {
        ihsgNav *= ihsg[i].close / prev.close;
        picksNav *= ihsg[i].close / prev.close;
      }
    }
    out.push({ date: ihsg[i].date, picks: picksNav, ihsg: ihsgNav });
  }
  return out;
}

export function sliceAndScore(
  stocks: ScoredStock[],
  ihsg: Bar[],
  endExclusive: number,
): ScoredStock[] {
  const ihsgSlice = ihsg.slice(0, endExclusive);
  const lastDate = ihsgSlice[ihsgSlice.length - 1]?.date;
  const raws = stocks.map((s) => {
    const bars = s.bars.filter((b) => b.date <= lastDate);
    const usable = bars.length > 30 ? bars : s.bars.slice(0, Math.max(2, endExclusive));
    return prepareStock(
      {
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        cap: s.cap,
        beta: 1,
        lastPrice: usable[usable.length - 1]?.close ?? s.price,
      },
      usable,
      ihsgSlice,
      { pe: s.pe, pb: s.pb, marketCap: s.marketCap, dataQuality: s.dataQuality },
    );
  });
  return scoreUniverse(raws, ihsgSlice);
}
