import type { Bar } from "../types";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

export type YahooQuote = {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  week52High: number | null;
  week52Low: number | null;
  marketCap: number | null;
  pe: number | null;
  pb: number | null;
  avgVolume: number | null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

async function yahooFetch(url: string, timeoutMs = 3000): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function fetchChart(
  symbol: string,
  range = "1y",
  interval = "1d",
): Promise<Bar[] | null> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&events=div%7Csplit`;
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await yahooFetch(`https://${host}${path}`, 2800);
      if (!res.ok) continue;
      const json = (await res.json()) as YahooChartResponse;
      const result = json.chart?.result?.[0];
      const ts = result?.timestamp ?? [];
      const q = result?.indicators?.quote?.[0];
      if (!ts.length || !q) continue;
      const bars: Bar[] = [];
      for (let i = 0; i < ts.length; i += 1) {
        const close = q.close?.[i];
        if (close == null || !Number.isFinite(close)) continue;
        bars.push({
          date: formatStamp(ts[i], interval),
          open: q.open?.[i] ?? close,
          high: q.high?.[i] ?? close,
          low: q.low?.[i] ?? close,
          close,
          volume: q.volume?.[i] ?? 0,
        });
      }
      const min = interval === "1d" ? 10 : 4;
      if (bars.length > min) return bars;
    } catch {
      continue;
    }
  }
  return null;
}

function formatStamp(ts: number, interval: string): string {
  const d = new Date(ts * 1000);
  if (interval === "1d") return d.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

type ChartMeta = {
  symbol?: string;
  shortName?: string;
  exchangeName?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketVolume?: number;
  regularMarketChangePercent?: number;
};

export async function fetchQuoteViaChart(symbol: string): Promise<YahooQuote | null> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  for (const host of YAHOO_HOSTS) {
    try {
      const res = await yahooFetch(`https://${host}${path}`, 3500);
      if (!res.ok) continue;
      const json = (await res.json()) as YahooChartResponse & {
        chart?: { result?: Array<{ meta?: ChartMeta }> };
      };
      const result = json.chart?.result?.[0];
      const meta = result?.meta;
      const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
        (c): c is number => c != null && Number.isFinite(c) && c > 0,
      );
      const price = Number(meta?.regularMarketPrice ?? closes[closes.length - 1]);
      if (!Number.isFinite(price) || price <= 0) continue;
      const prevFromBars = closes.length >= 2 ? closes[closes.length - 2] : 0;
      const prev = prevFromBars > 0 ? prevFromBars : Number(meta?.previousClose ?? meta?.chartPreviousClose ?? 0);
      const changePct = prev > 0 ? price / prev - 1 : 0;
      return {
        symbol,
        name: String(meta?.shortName ?? ""),
        exchange: String(meta?.exchangeName ?? ""),
        price,
        changePct,
        open: Number(meta?.regularMarketOpen ?? price),
        high: Number(meta?.regularMarketDayHigh ?? price),
        low: Number(meta?.regularMarketDayLow ?? price),
        volume: Number(meta?.regularMarketVolume ?? 0),
        week52High: null,
        week52Low: null,
        marketCap: null,
        pe: null,
        pb: null,
        avgVolume: null,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const { fetchLiveQuotes } = await import("./live");
  return fetchLiveQuotes(symbols);
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      ret[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return ret;
}
