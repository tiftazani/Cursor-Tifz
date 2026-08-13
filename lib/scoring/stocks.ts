import type { Bar, Factor, RecLabel, ScoredStock, StockMeta } from "../types";
import {
  alignReturn,
  macdHistogram,
  mean,
  pctChange,
  realizedVol,
  returnN,
  rsi,
  sma,
  ytdReturn,
  zScores,
} from "../indicators";
import { num, pct } from "../format";

type Regime = "risk_on" | "risk_off" | "neutral";

type WeightSet = {
  alpha1w: number;
  alpha1m: number;
  alpha3m: number;
  sectorRel: number;
  valuePe: number;
  valuePb: number;
  liquidity: number;
  rsi: number;
  ma: number;
  macd: number;
  volPenalty: number;
  week52: number;
  conviction: number;
};

const WEIGHTS: Record<Regime, WeightSet> = {
  risk_on: {
    alpha1w: 0.14,
    alpha1m: 0.16,
    alpha3m: 0.08,
    sectorRel: 0.1,
    valuePe: 0.05,
    valuePb: 0.03,
    liquidity: 0.1,
    rsi: 0.06,
    ma: 0.08,
    macd: 0.08,
    volPenalty: 0.04,
    week52: 0.04,
    conviction: 0.04,
  },
  risk_off: {
    alpha1w: 0.06,
    alpha1m: 0.1,
    alpha3m: 0.12,
    sectorRel: 0.06,
    valuePe: 0.12,
    valuePb: 0.08,
    liquidity: 0.1,
    rsi: 0.05,
    ma: 0.06,
    macd: 0.04,
    volPenalty: 0.12,
    week52: 0.05,
    conviction: 0.04,
  },
  neutral: {
    alpha1w: 0.1,
    alpha1m: 0.14,
    alpha3m: 0.1,
    sectorRel: 0.08,
    valuePe: 0.08,
    valuePb: 0.05,
    liquidity: 0.1,
    rsi: 0.06,
    ma: 0.08,
    macd: 0.06,
    volPenalty: 0.07,
    week52: 0.05,
    conviction: 0.03,
  },
};

export function recLabel(score: number): RecLabel {
  if (score >= 70) return "Beli";
  if (score >= 50) return "Tahan";
  return "Waspada";
}

type Raw = {
  meta: StockMeta;
  bars: Bar[];
  yahooSymbol: string;
  price: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  week52High: number;
  week52Low: number;
  pe: number | null;
  pb: number | null;
  marketCap: number | null;
  dataQuality: ScoredStock["dataQuality"];
  ret1m: number;
  ret3m: number;
  retYtd: number;
  alpha1w: number;
  alpha1m: number;
  alpha3m: number;
  volatility: number;
  rsi: number;
  ma20: number;
  ma50: number;
  avgVolume20: number;
  volumeRatio: number;
  pos52: number;
  valuePe: number;
  valuePb: number;
  maSignal: number;
  rsiCentered: number;
  macd: number;
  conviction: number;
};

export function prepareStock(meta: StockMeta, bars: Bar[], ihsg: Bar[], extras?: Partial<Raw>): Raw {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2] ?? last;
  const a1w = alignReturn(bars, ihsg, 5);
  const a1 = alignReturn(bars, ihsg, 21);
  const a3 = alignReturn(bars, ihsg, 63);
  const vols = bars.slice(-20).map((b) => b.volume);
  const avgVolume20 = mean(vols.length ? vols : [last.volume]);
  const week52High = Math.max(...bars.slice(-252).map((b) => b.high));
  const week52Low = Math.min(...bars.slice(-252).map((b) => b.low));
  const rsiVal = rsi(closes);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const pe = extras?.pe ?? null;
  const pb = extras?.pb ?? null;
  const volumeRatio = avgVolume20 ? last.volume / avgVolume20 : 1;
  const maSignal = (last.close / (ma20 || last.close) - 1) * 0.6 + (ma20 / (ma50 || ma20) - 1) * 0.4;
  const macd = macdHistogram(closes);
  return {
    meta,
    bars,
    yahooSymbol: `${meta.ticker}.JK`,
    price: last.close,
    changePct: pctChange(prev.close, last.close),
    open: last.open,
    high: last.high,
    low: last.low,
    volume: last.volume,
    week52High,
    week52Low,
    pe,
    pb,
    marketCap: extras?.marketCap ?? null,
    dataQuality: extras?.dataQuality ?? "synthetic",
    ret1m: returnN(closes, 21),
    ret3m: returnN(closes, 63),
    retYtd: ytdReturn(bars),
    alpha1w: a1w.a - a1w.b,
    alpha1m: a1.a - a1.b,
    alpha3m: a3.a - a3.b,
    volatility: realizedVol(closes, 30),
    rsi: rsiVal,
    ma20,
    ma50,
    avgVolume20,
    volumeRatio,
    pos52: week52High === week52Low ? 0.5 : (last.close - week52Low) / (week52High - week52Low),
    valuePe: pe && pe > 0 ? -Math.log(pe) : 0,
    valuePb: pb && pb > 0 ? -Math.log(pb) : 0,
    maSignal,
    rsiCentered: 1 - Math.abs(rsiVal - 55) / 50,
    macd,
    conviction: Math.log(volumeRatio + 0.05) * (last.close >= ma20 ? 1 : -0.6),
  };
}

export function detectRegime(ihsg: Bar[]): Regime {
  if (ihsg.length < 30) return "neutral";
  const closes = ihsg.map((b) => b.close);
  const r1m = returnN(closes, 21);
  const last = closes[closes.length - 1];
  const ma20 = sma(closes, 20);
  const macd = macdHistogram(closes);
  if (r1m > 0.015 && last >= ma20 && macd >= 0) return "risk_on";
  if (r1m < -0.015 || (last < ma20 && macd < 0 && r1m < 0)) return "risk_off";
  return "neutral";
}

export function scoreUniverse(raws: Raw[], ihsg: Bar[] = []): ScoredStock[] {
  const regime = detectRegime(ihsg);
  const W = WEIGHTS[regime];
  const sectorMean = new Map<string, number>();
  const sectorBuckets = new Map<string, number[]>();
  for (const r of raws) {
    const list = sectorBuckets.get(r.meta.sector) ?? [];
    list.push(r.alpha1m);
    sectorBuckets.set(r.meta.sector, list);
  }
  for (const [sector, vals] of sectorBuckets) {
    sectorMean.set(sector, mean(vals));
  }
  const sectorRel = raws.map((r) => r.alpha1m - (sectorMean.get(r.meta.sector) ?? 0));

  const z = {
    alpha1w: zScores(raws.map((r) => r.alpha1w)),
    alpha1m: zScores(raws.map((r) => r.alpha1m)),
    alpha3m: zScores(raws.map((r) => r.alpha3m)),
    sectorRel: zScores(sectorRel),
    valuePe: zScores(raws.map((r) => r.valuePe)),
    valuePb: zScores(raws.map((r) => r.valuePb)),
    liquidity: zScores(raws.map((r) => Math.log(r.volumeRatio + 0.01))),
    rsi: zScores(raws.map((r) => r.rsiCentered)),
    ma: zScores(raws.map((r) => r.maSignal)),
    macd: zScores(raws.map((r) => r.macd)),
    volPenalty: zScores(raws.map((r) => -r.volatility)),
    week52: zScores(raws.map((r) => r.pos52)),
    conviction: zScores(raws.map((r) => r.conviction)),
  };

  return raws
    .map((r, i) => {
      const factors: Factor[] = [
        factor("alpha1w", "Alpha 1 minggu vs IHSG", r.alpha1w, pct(r.alpha1w), z.alpha1w[i], W.alpha1w),
        factor("alpha1m", "Alpha 1 bulan vs IHSG", r.alpha1m, pct(r.alpha1m), z.alpha1m[i], W.alpha1m),
        factor("alpha3m", "Alpha 3 bulan vs IHSG", r.alpha3m, pct(r.alpha3m), z.alpha3m[i], W.alpha3m),
        factor("sectorRel", "Relatif vs sektor", sectorRel[i], pct(sectorRel[i]), z.sectorRel[i], W.sectorRel),
        factor("valuePe", "Valuasi P/E", r.pe ?? 0, r.pe ? num(r.pe, 1) + "x" : "n/a", z.valuePe[i], W.valuePe),
        factor("valuePb", "Valuasi P/B", r.pb ?? 0, r.pb ? num(r.pb, 2) + "x" : "n/a", z.valuePb[i], W.valuePb),
        factor("liquidity", "Likuiditas vs rata-rata 20 hari", r.volumeRatio, num(r.volumeRatio, 2) + "x", z.liquidity[i], W.liquidity),
        factor("rsi", "RSI 14", r.rsi, num(r.rsi, 1), z.rsi[i], W.rsi),
        factor("ma", "Sinyal MA20/MA50", r.maSignal, pct(r.price / r.ma20 - 1), z.ma[i], W.ma),
        factor("macd", "MACD histogram", r.macd, num(r.macd, 2), z.macd[i], W.macd),
        factor("volPenalty", "Volatilitas (penalti)", r.volatility, pct(r.volatility, 1, false), z.volPenalty[i], W.volPenalty),
        factor("week52", "Posisi vs 52 minggu", r.pos52, pct(r.pos52, 0, false), z.week52[i], W.week52),
        factor("conviction", "Konfirmasi volume", r.conviction, num(r.volumeRatio, 2) + "x", z.conviction[i], W.conviction),
      ];
      const contrib = factors.reduce((s, f) => s + f.contribution, 0);
      const score = clamp(50 + 10 * contrib, 8, 96);
      const spark = r.bars.slice(-30).map((b) => b.close);
      const stock: ScoredStock = {
        ticker: r.meta.ticker,
        yahooSymbol: r.yahooSymbol,
        name: r.meta.name,
        sector: r.meta.sector,
        cap: r.meta.cap,
        score,
        label: recLabel(score),
        price: r.price,
        changePct: r.changePct,
        open: r.open,
        high: r.high,
        low: r.low,
        volume: r.volume,
        avgVolume20: r.avgVolume20,
        volumeRatio: r.volumeRatio,
        week52High: r.week52High,
        week52Low: r.week52Low,
        pe: r.pe,
        pb: r.pb,
        marketCap: r.marketCap,
        ret1m: r.ret1m,
        ret3m: r.ret3m,
        retYtd: r.retYtd,
        alpha1m: r.alpha1m,
        alpha3m: r.alpha3m,
        volatility: r.volatility,
        rsi: r.rsi,
        ma20: r.ma20,
        ma50: r.ma50,
        spark,
        bars: r.bars,
        factors,
        insight: "",
        dataQuality: r.dataQuality,
      };
      return stock;
    })
    .sort((a, b) => b.score - a.score);
}

function factor(
  key: string,
  label: string,
  value: number,
  display: string,
  z: number,
  weight: number,
): Factor {
  return { key, label, value, display, z, weight, contribution: z * weight };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
