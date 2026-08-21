import type { MarketStatus } from "../types";
import { formatIhsgChartTime, formatWibClock, isIdxSession, marketStatus } from "../time";
import { fetchLiveQuotes } from "./live";
import { fetchChart } from "./yahoo";

const IHSG_SYMBOL = "^JKSE";

export type IhsgTick = {
  last: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  chart: { date: string; value: number }[];
  chartKind: "intraday" | "daily";
  marketStatus: MarketStatus;
  session: boolean;
  clock: string;
  generatedAt: string;
};

type ChartMem = {
  at: number;
  points: { date: string; value: number }[];
  kind: "intraday" | "daily";
};

let chartMem: ChartMem | null = null;

async function loadChart(): Promise<ChartMem> {
  const now = Date.now();
  if (chartMem && now - chartMem.at < 15_000) return chartMem;
  const oneMin = await fetchChart(IHSG_SYMBOL, "1d", "1m");
  if (oneMin && oneMin.length > 8) {
    chartMem = {
      at: now,
      points: oneMin.map((b) => ({ date: b.date, value: b.close })),
      kind: "intraday",
    };
    return chartMem;
  }
  const fiveMin = await fetchChart(IHSG_SYMBOL, "1d", "5m");
  if (fiveMin && fiveMin.length > 8) {
    chartMem = {
      at: now,
      points: fiveMin.map((b) => ({ date: b.date, value: b.close })),
      kind: "intraday",
    };
    return chartMem;
  }
  chartMem = { at: now, points: [], kind: "daily" };
  return chartMem;
}

function withLiveHead(points: { date: string; value: number }[], last: number, at = new Date()) {
  const label = formatIhsgChartTime(at);
  if (!points.length) return [{ date: label, value: last }];
  const next = points.slice();
  const tail = next[next.length - 1];
  if (tail.date === label) {
    next[next.length - 1] = { date: label, value: last };
    return next;
  }
  next.push({ date: label, value: last });
  return next;
}

export async function fetchIhsgTick(): Promise<IhsgTick | null> {
  const [quotes, chart] = await Promise.all([fetchLiveQuotes([IHSG_SYMBOL]), loadChart()]);
  const q = quotes.get(IHSG_SYMBOL);
  if (!q) return null;
  const now = new Date();
  const session = isIdxSession(now);
  return {
    last: q.price,
    changePct: q.changePct,
    open: q.open,
    high: q.high,
    low: q.low,
    chart: withLiveHead(chart.points, q.price, now),
    chartKind: chart.kind,
    marketStatus: session ? "open" : marketStatus(now),
    session,
    clock: formatWibClock(now),
    generatedAt: now.toISOString(),
  };
}
