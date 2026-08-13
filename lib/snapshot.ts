import { connection } from "next/server";
import stockUniverse from "@/data/stocks-universe.json";
import fundCatalog from "@/data/funds-catalog.json";
import type { Bar, DailySnapshot, FundMeta, ScoredStock, StockMeta } from "./types";
import { cacheKey, latestCache, readCache, writeCache } from "./cache";
import { fetchChart, fetchQuotes, mapPool, type YahooQuote } from "./market/yahoo";
import { overlayQuote, syntheticIhsg, syntheticStock } from "./market/synthetic";
import { prepareStock, scoreUniverse } from "./scoring/stocks";
import { buildFundSeries, prepareFund, scoreFunds } from "./scoring/funds";
import { narrateFund, narrateStock } from "./insights/narrate";
import { buildInvestorPulse } from "./investor/pulse";
import { buildAnalytics, sliceAndScore } from "./analytics";
import { formatWibLong, marketStatus } from "./time";
import { pctChange, returnN, ytdReturn } from "./indicators";

const IHSG_SYMBOL = "^JKSE";
const stocksMeta = stockUniverse as StockMeta[];
const fundsMeta = fundCatalog as FundMeta[];

let memory: { key: string; snapshot: DailySnapshot } | null = null;
let inflight: Promise<DailySnapshot> | null = null;

export async function getDailySnapshot(): Promise<DailySnapshot> {
  await connection();
  const key = cacheKey();
  if (memory && memory.key === key && !memory.snapshot.stale) {
    return memory.snapshot;
  }
  const cached = await readCache(key);
  if (cached) {
    memory = { key, snapshot: hydrateIhsg(cached) };
    return memory.snapshot;
  }
  if (!inflight) {
    inflight = buildSnapshot()
      .catch(async (err) => {
        const prev = await latestCache();
        if (prev) {
          return { ...prev, stale: true, notes: [...prev.notes, `Refresh gagal: ${String(err)}`] };
        }
        return buildFallback("fallback");
      })
      .finally(() => {
        inflight = null;
      });
  }
  const snap = await inflight;
  const hydrated = hydrateIhsg(snap);
  memory = { key, snapshot: hydrated };
  await writeCache(key, stripHeavy(hydrated));
  return hydrated;
}

function hydrateIhsg(snapshot: DailySnapshot): DailySnapshot {
  if (snapshot.ihsg.chart?.length) return snapshot;
  return {
    ...snapshot,
    ihsg: {
      ...snapshot.ihsg,
      chart: (snapshot.ihsg.bars ?? []).slice(-60).map((b) => ({ date: b.date, value: b.close })),
      chartKind: "daily",
    },
  };
}

function stripHeavy(snapshot: DailySnapshot): DailySnapshot {
  return {
    ...snapshot,
    stocks: snapshot.stocks.map((s) => ({ ...s, bars: s.bars.slice(-80) })),
    stockPicks: snapshot.stockPicks.map((s) => ({ ...s, bars: s.bars.slice(-80) })),
    ihsg: {
      ...snapshot.ihsg,
      bars: snapshot.ihsg.bars.slice(-80),
      chart: (snapshot.ihsg.chart ?? []).slice(-120),
    },
    funds: snapshot.funds.map((f) => ({ ...f, series: f.series.slice(-80) })),
  };
}

async function fetchIhsgIntraday(): Promise<Bar[] | null> {
  const day = await fetchChart(IHSG_SYMBOL, "1d", "5m");
  if (day && day.length > 8) return day;
  return fetchChart(IHSG_SYMBOL, "5d", "15m");
}

async function buildSnapshot(): Promise<DailySnapshot> {
  const symbols = stocksMeta.map((s) => `${s.ticker}.JK`);
  const [liveIhsg, intraday, quotes] = await Promise.all([
    fetchChart(IHSG_SYMBOL, "1y"),
    fetchIhsgIntraday(),
    fetchQuotes([IHSG_SYMBOL, ...symbols]),
  ]);
  const charts = await mapPool(stocksMeta, 6, async (meta) => {
    const bars = await fetchChart(`${meta.ticker}.JK`, "1y");
    return { ticker: meta.ticker, bars };
  });
  const chartMap = new Map(charts.map((c) => [c.ticker, c.bars]));

  const liveCount = charts.filter((c) => c.bars).length;
  const source =
    liveIhsg && liveCount > 12
      ? liveCount > 30 && quotes.size > 20
        ? "live"
        : "mixed"
      : quotes.size > 10
        ? "mixed"
        : "fallback";

  if (source === "fallback" && !liveIhsg && quotes.size === 0) {
    return buildFallback("fallback");
  }

  let ihsg = liveIhsg ?? syntheticIhsg();
  const ihsgQuote = quotes.get(IHSG_SYMBOL);
  if (ihsgQuote) ihsg = overlayQuote(ihsg, ihsgQuote);

  const raws = stocksMeta.map((meta) => {
    const q = quotes.get(`${meta.ticker}.JK`);
    let bars = chartMap.get(meta.ticker) ?? null;
    let quality: ScoredStock["dataQuality"] = bars ? "full" : "synthetic";
    if (!bars) {
      bars = syntheticStock(meta, ihsg);
      quality = q ? "partial" : "synthetic";
    }
    if (q) bars = overlayQuote(bars, q);
    return prepareStock(meta, bars, ihsg, {
      pe: q?.pe ?? null,
      pb: q?.pb ?? null,
      marketCap: q?.marketCap ?? null,
      dataQuality: quality,
    });
  });

  const stocks = scoreUniverse(raws, ihsg).map((s) => ({ ...s, insight: narrateStock(s) }));
  return assemble(ihsg, stocks, source, false, { quote: ihsgQuote, intraday });
}

function buildFallback(source: DailySnapshot["source"]): DailySnapshot {
  const ihsg = syntheticIhsg();
  const raws = stocksMeta.map((meta) =>
    prepareStock(meta, syntheticStock(meta, ihsg), ihsg, { dataQuality: "synthetic" }),
  );
  const stocks = scoreUniverse(raws, ihsg).map((s) => ({ ...s, insight: narrateStock(s) }));
  return assemble(ihsg, stocks, source, source !== "live");
}

function assemble(
  ihsg: Bar[],
  stocks: ScoredStock[],
  source: DailySnapshot["source"],
  stale: boolean,
  extras?: { quote?: YahooQuote; intraday?: Bar[] | null },
): DailySnapshot {
  const last = ihsg[ihsg.length - 1];
  const prev = ihsg[ihsg.length - 2] ?? last;
  const quote = extras?.quote;
  const fundRaws = fundsMeta.map((f) => prepareFund(f, buildFundSeries(f, ihsg), ihsg));
  const funds = scoreFunds(fundRaws).map((f) => ({ ...f, insight: narrateFund(f) }));
  const pickCat = (cat: "pasar_uang" | "saham" | "obligasi") =>
    funds.filter((f) => f.category === cat).sort((a, b) => b.score - a.score)[0];

  const analytics = buildAnalytics(stocks, ihsg, (end) =>
    sliceAndScore(stocks, ihsg, end).map((s) => ({ ...s, insight: s.insight })),
  );

  const intraday = extras?.intraday ?? [];
  const chart =
    intraday.length > 8
      ? intraday.map((b) => ({ date: b.date, value: b.close }))
      : ihsg.slice(-60).map((b) => ({ date: b.date, value: b.close }));

  return {
    asOf: last.date,
    asOfWib: formatWibLong(),
    generatedAt: new Date().toISOString(),
    stale,
    source,
    marketStatus: marketStatus(),
    ihsg: {
      last: quote?.price ?? last.close,
      prev: prev.close,
      changePct: quote?.changePct ?? pctChange(prev.close, last.close),
      high: quote?.high ?? last.high,
      low: quote?.low ?? last.low,
      open: quote?.open ?? last.open,
      spark: ihsg.slice(-30).map((b) => b.close),
      bars: ihsg,
      chart,
      chartKind: intraday.length > 8 ? "intraday" : "daily",
      ret1m: returnN(
        ihsg.map((b) => b.close),
        21,
      ),
      ret3m: returnN(
        ihsg.map((b) => b.close),
        63,
      ),
      retYtd: ytdReturn(ihsg),
    },
    stocks,
    stockPicks: stocks.slice(0, 5),
    funds,
    fundPicks: {
      pasar_uang: pickCat("pasar_uang"),
      saham: pickCat("saham"),
      obligasi: pickCat("obligasi"),
    },
    investor: buildInvestorPulse(stocks, funds),
    analytics,
    notes: [],
  };
}
