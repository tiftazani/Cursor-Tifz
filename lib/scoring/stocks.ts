import type { Bar, Factor, RecLabel, ScoredStock, StockMeta } from "../types";
import {
  alignReturn,
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

const WEIGHTS = {
  alpha1m: 0.22,
  alpha3m: 0.15,
  valuePe: 0.1,
  valuePb: 0.06,
  liquidity: 0.12,
  rsi: 0.08,
  ma: 0.1,
  volPenalty: 0.09,
  week52: 0.08,
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
};

export function prepareStock(meta: StockMeta, bars: Bar[], ihsg: Bar[], extras?: Partial<Raw>): Raw {
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2] ?? last;
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
    alpha1m: a1.a - a1.b,
    alpha3m: a3.a - a3.b,
    volatility: realizedVol(closes, 30),
    rsi: rsiVal,
    ma20,
    ma50,
    avgVolume20,
    volumeRatio: avgVolume20 ? last.volume / avgVolume20 : 1,
    pos52: week52High === week52Low ? 0.5 : (last.close - week52Low) / (week52High - week52Low),
    valuePe: pe && pe > 0 ? -Math.log(pe) : 0,
    valuePb: pb && pb > 0 ? -Math.log(pb) : 0,
    maSignal: (last.close / (ma20 || last.close) - 1) * 0.6 + (ma20 / (ma50 || ma20) - 1) * 0.4,
    rsiCentered: 1 - Math.abs(rsiVal - 58) / 50,
  };
}

export function scoreUniverse(raws: Raw[]): ScoredStock[] {
  const z = {
    alpha1m: zScores(raws.map((r) => r.alpha1m)),
    alpha3m: zScores(raws.map((r) => r.alpha3m)),
    valuePe: zScores(raws.map((r) => r.valuePe)),
    valuePb: zScores(raws.map((r) => r.valuePb)),
    liquidity: zScores(raws.map((r) => Math.log(r.volumeRatio + 0.01))),
    rsi: zScores(raws.map((r) => r.rsiCentered)),
    ma: zScores(raws.map((r) => r.maSignal)),
    volPenalty: zScores(raws.map((r) => -r.volatility)),
    week52: zScores(raws.map((r) => r.pos52)),
  };

  return raws
    .map((r, i) => {
      const factors: Factor[] = [
        factor("alpha1m", "Alpha 1 bulan vs IHSG", r.alpha1m, pct(r.alpha1m), z.alpha1m[i], WEIGHTS.alpha1m),
        factor("alpha3m", "Alpha 3 bulan vs IHSG", r.alpha3m, pct(r.alpha3m), z.alpha3m[i], WEIGHTS.alpha3m),
        factor("valuePe", "Valuasi P/E (lebih rendah lebih baik)", r.pe ?? 0, r.pe ? num(r.pe, 1) + "x" : "n/a", z.valuePe[i], WEIGHTS.valuePe),
        factor("valuePb", "Valuasi P/B", r.pb ?? 0, r.pb ? num(r.pb, 2) + "x" : "n/a", z.valuePb[i], WEIGHTS.valuePb),
        factor("liquidity", "Likuiditas vs rata-rata 20 hari", r.volumeRatio, num(r.volumeRatio, 2) + "x", z.liquidity[i], WEIGHTS.liquidity),
        factor("rsi", "RSI 14 (momentum sehat)", r.rsi, num(r.rsi, 1), z.rsi[i], WEIGHTS.rsi),
        factor("ma", "Sinyal MA20/MA50", r.maSignal, pct(r.price / r.ma20 - 1), z.ma[i], WEIGHTS.ma),
        factor("volPenalty", "Volatilitas (penalti)", r.volatility, pct(r.volatility, 1, false), z.volPenalty[i], WEIGHTS.volPenalty),
        factor("week52", "Posisi vs 52 minggu", r.pos52, pct(r.pos52, 0, false), z.week52[i], WEIGHTS.week52),
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
