import type { Bar } from "./types";

export function closesOf(bars: Bar[]): number[] {
  return bars.map((b) => b.close);
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function zScores(values: number[]): number[] {
  const s = stdev(values);
  if (s === 0) return values.map(() => 0);
  const m = mean(values);
  return values.map((v) => {
    const z = (v - m) / s;
    return Math.max(-3, Math.min(3, z));
  });
}

export function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return to / from - 1;
}

export function returnN(closes: number[], days: number): number {
  if (closes.length < days + 1) return pctChange(closes[0] ?? 0, closes[closes.length - 1] ?? 0);
  const end = closes[closes.length - 1];
  const start = closes[closes.length - 1 - days];
  return pctChange(start, end);
}

export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    out.push(pctChange(closes[i - 1], closes[i]));
  }
  return out;
}

export function emaLast(values: number[], period: number): number {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i += 1) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

export function macdHistogram(closes: number[]): number {
  if (closes.length < 35) return 0;
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  const k9 = 2 / 10;
  let e12 = closes[0];
  let e26 = closes[0];
  const macd: number[] = [];
  for (let i = 0; i < closes.length; i += 1) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    macd.push(e12 - e26);
  }
  let signal = macd[0];
  for (let i = 0; i < macd.length; i += 1) {
    signal = macd[i] * k9 + signal * (1 - k9);
  }
  return macd[macd.length - 1] - signal;
}

export function downsideVol(closes: number[], window = 30): number {
  const rets = dailyReturns(closes.slice(-(window + 1))).filter((r) => r < 0);
  if (rets.length < 3) return realizedVol(closes, window) * 0.6;
  return stdev(rets) * Math.sqrt(252);
}

export function consistency(closes: number[], window = 21): number {
  if (closes.length < window * 3) return 0.5;
  let wins = 0;
  let n = 0;
  for (let i = window; i < closes.length; i += window) {
    n += 1;
    if (closes[i] >= closes[i - window]) wins += 1;
  }
  return n ? wins / n : 0.5;
}

export function sma(values: number[], period: number): number {
  if (!values.length) return 0;
  const slice = values.slice(-period);
  return mean(slice);
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = dailyReturns(closes.slice(-(period + 1)));
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? -c : 0));
  const avgGain = mean(gains);
  const avgLoss = mean(losses);
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function realizedVol(closes: number[], window = 30): number {
  const rets = dailyReturns(closes.slice(-(window + 1)));
  return stdev(rets) * Math.sqrt(252);
}

export function maxDrawdown(closes: number[]): number {
  let peak = closes[0] ?? 0;
  let dd = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    if (peak > 0) dd = Math.min(dd, c / peak - 1);
  }
  return dd;
}

export function sharpe(closes: number[], rfAnn = 0.055): number {
  const rets = dailyReturns(closes);
  if (rets.length < 10) return 0;
  const excess = mean(rets) * 252 - rfAnn;
  const vol = stdev(rets) * Math.sqrt(252);
  if (vol === 0) return 0;
  return excess / vol;
}

export function ytdReturn(bars: Bar[]): number {
  if (!bars.length) return 0;
  const year = bars[bars.length - 1].date.slice(0, 4);
  const first = bars.find((b) => b.date.startsWith(year)) ?? bars[0];
  return pctChange(first.close, bars[bars.length - 1].close);
}

export function alignReturn(a: Bar[], b: Bar[], days: number): { a: number; b: number } {
  const map = new Map(b.map((bar) => [bar.date, bar.close]));
  const end = a[a.length - 1];
  if (!end) return { a: 0, b: 0 };
  const startIdx = Math.max(0, a.length - 1 - days);
  const start = a[startIdx];
  const bEnd = map.get(end.date);
  const bStart = map.get(start.date);
  if (!bEnd || !bStart) return { a: pctChange(start.close, end.close), b: 0 };
  return { a: pctChange(start.close, end.close), b: pctChange(bStart, bEnd) };
}
