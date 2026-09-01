import type { YahooQuote } from "./yahoo";
import { fetchQuoteViaChart, mapPool } from "./yahoo";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const IHSG_SYMBOL = "^JKSE";

export async function fetchLiveQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const out = new Map<string, YahooQuote>();
  if (!symbols.length) return out;

  const idxSymbols = symbols.filter((s) => s.endsWith(".JK") || s === IHSG_SYMBOL);
  const other = symbols.filter((s) => !idxSymbols.includes(s));

  const tv = await fetchTradingViewQuotes(idxSymbols);
  for (const [k, v] of tv) out.set(k, v);

  const missing = [...idxSymbols.filter((s) => !out.has(s)), ...other];
  if (missing.length) {
    const extras = await mapPool(missing, 8, async (symbol) => {
      const q = await fetchQuoteViaChart(symbol);
      return { symbol, q };
    });
    for (const { symbol, q } of extras) {
      if (q) out.set(symbol, { ...q, symbol });
    }
  }
  return out;
}

async function fetchTradingViewQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const out = new Map<string, YahooQuote>();
  if (!symbols.length) return out;
  const tickers = [...new Set(symbols.map(toTvTicker).filter(Boolean))];
  if (!tickers.length) return out;

  try {
    const res = await fetch("https://scanner.tradingview.com/indonesia/scan", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
      },
      body: JSON.stringify({
        symbols: { tickers, query: { types: [] } },
        columns: ["close", "change", "change_abs", "volume", "open", "high", "low", "previous_close", "description"],
        range: [0, tickers.length],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return out;
    const json = (await res.json()) as {
      data?: Array<{ s: string; d: Array<number | string | null> }>;
    };
    for (const row of json.data ?? []) {
      const mapped = fromTvTicker(row.s);
      const close = Number(row.d[0]);
      if (!mapped || !Number.isFinite(close) || close <= 0) continue;
      const changePctRaw = Number(row.d[1] ?? 0);
      const changeAbs = Number(row.d[2]);
      const changePct = Number.isFinite(changePctRaw) ? changePctRaw / 100 : 0;
      const open = Number(row.d[4] ?? close);
      const high = Number(row.d[5] ?? close);
      const low = Number(row.d[6] ?? close);
      const desc = typeof row.d[8] === "string" ? row.d[8].replace(/^PT\s+/i, "").trim() : "";
      out.set(mapped, {
        symbol: mapped,
        name: desc,
        exchange: "IDX",
        price: close,
        changePct: Number.isFinite(changeAbs) && close !== changeAbs
          ? changeAbs / (close - changeAbs)
          : changePct,
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        volume: Number(row.d[3] ?? 0) || 0,
        week52High: null,
        week52Low: null,
        marketCap: null,
        pe: null,
        pb: null,
        avgVolume: null,
      });
    }
  } catch {
    return out;
  }
  return out;
}

function toTvTicker(symbol: string): string {
  if (symbol === IHSG_SYMBOL) return "IDX:COMPOSITE";
  if (symbol.endsWith(".JK")) return `IDX:${symbol.replace(/\.JK$/i, "")}`;
  return "";
}

function fromTvTicker(tv: string): string | null {
  if (tv === "IDX:COMPOSITE") return IHSG_SYMBOL;
  const m = tv.match(/^IDX:([A-Z0-9]+)$/i);
  return m ? `${m[1].toUpperCase()}.JK` : null;
}
