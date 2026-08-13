import { hashString, mulberry32, randn } from "../rng";
import type { Bar, StockMeta } from "../types";
import { tradingDatesBack } from "../time";

export function syntheticIhsg(days = 260, end = new Date()): Bar[] {
  const dates = tradingDatesBack(days, end);
  const rng = mulberry32(hashString(`ihsg:${dates[dates.length - 1]}`));
  let price = 5850;
  const bars: Bar[] = [];
  for (const date of dates) {
    const r = 0.00025 + randn(rng) * 0.009;
    const open = price * (1 + randn(rng) * 0.002);
    price = Math.max(4200, price * (1 + r));
    const high = Math.max(open, price) * (1 + rng() * 0.006);
    const low = Math.min(open, price) * (1 - rng() * 0.006);
    bars.push({
      date,
      open,
      high,
      low,
      close: price,
      volume: 250_000_000 + rng() * 180_000_000,
    });
  }
  return bars;
}

export function syntheticStock(meta: StockMeta, ihsg: Bar[]): Bar[] {
  const rng = mulberry32(hashString(`stk:${meta.ticker}:${ihsg[ihsg.length - 1]?.date}`));
  let price = meta.lastPrice * (0.82 + rng() * 0.12);
  const bars: Bar[] = [];
  for (let i = 0; i < ihsg.length; i += 1) {
    const rIhsg = i === 0 ? 0 : ihsg[i].close / ihsg[i - 1].close - 1;
    const idio = randn(rng) * 0.016;
    const r = meta.beta * rIhsg + idio + 0.0001;
    const open = price * (1 + randn(rng) * 0.004);
    price = Math.max(meta.lastPrice * 0.35, price * (1 + r));
    const high = Math.max(open, price) * (1 + rng() * 0.01);
    const low = Math.min(open, price) * (1 - rng() * 0.01);
    const baseVol =
      meta.cap === "large" ? 40_000_000 : meta.cap === "mid" ? 18_000_000 : 8_000_000;
    bars.push({
      date: ihsg[i].date,
      open,
      high,
      low,
      close: price,
      volume: baseVol * (0.6 + rng() * 1.1),
    });
  }
  return scaleLast(bars, meta.lastPrice);
}

export function scaleLast(bars: Bar[], lastPrice: number): Bar[] {
  if (!bars.length || !lastPrice) return bars;
  const factor = lastPrice / bars[bars.length - 1].close;
  return bars.map((b) => ({
    ...b,
    open: b.open * factor,
    high: b.high * factor,
    low: b.low * factor,
    close: b.close * factor,
    volume: b.volume,
  }));
}

export function overlayQuote(
  bars: Bar[],
  quote: { price: number; open: number; high: number; low: number; volume: number },
): Bar[] {
  if (!bars.length) return bars;
  const scaled = scaleLast(bars, quote.price);
  const last = scaled[scaled.length - 1];
  scaled[scaled.length - 1] = {
    ...last,
    open: quote.open || last.open,
    high: quote.high || last.high,
    low: quote.low || last.low,
    close: quote.price,
    volume: quote.volume || last.volume,
  };
  return scaled;
}
