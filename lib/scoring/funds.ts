import { hashString, mulberry32, randn } from "../rng";
import { maxDrawdown, realizedVol, returnN, sharpe, ytdReturn, zScores } from "../indicators";
import { recLabel } from "./stocks";
import { num, pct } from "../format";
import type { Bar, Factor, FundCategory, FundMeta, FundPoint, ScoredFund } from "../types";

export function buildFundSeries(fund: FundMeta, ihsg: Bar[]): FundPoint[] {
  const rng = mulberry32(hashString(`fund:${fund.id}:${ihsg[ihsg.length - 1]?.date}`));
  let nab = 1_000;
  let aum = fund.aumMiliar;
  const series: FundPoint[] = [
    { date: ihsg[0].date, nab, aum, flow: 0 },
  ];
  for (let i = 1; i < ihsg.length; i += 1) {
    const rIhsg = ihsg[i].close / ihsg[i - 1].close - 1;
    let r = 0;
    if (fund.category === "pasar_uang") {
      r = Math.max(0.00002, fund.yieldAnn / 365 + (rng() - 0.5) * 0.00004);
    } else if (fund.category === "saham") {
      r = fund.alphaAnn / 252 + fund.beta * rIhsg + randn(rng) * (fund.volAnn / Math.sqrt(252)) * 0.35;
    } else {
      r =
        fund.yieldAnn / 365 -
        fund.durationYears * 0.12 * rIhsg * 0.08 +
        randn(rng) * (fund.volAnn / Math.sqrt(252)) * 0.3;
    }
    nab *= 1 + r;
    const flowPct = (rng() - 0.47) * 0.006;
    const flow = aum * flowPct;
    aum = Math.max(50, aum * (1 + r) + flow);
    series.push({ date: ihsg[i].date, nab, aum, flow });
  }
  return series;
}

type RawFund = {
  meta: FundMeta;
  series: FundPoint[];
  ret1m: number;
  ret3m: number;
  ret1y: number;
  retYtd: number;
  vol: number;
  dd: number;
  sharpe: number;
  alpha1y: number;
  flow1d: number;
  flow5d: number;
  flow21d: number;
  nabChangePct: number;
  expense: number;
  aumLog: number;
};

export function prepareFund(meta: FundMeta, series: FundPoint[], ihsg: Bar[]): RawFund {
  const nabs = series.map((s) => s.nab);
  const bars: Bar[] = series.map((s) => ({
    date: s.date,
    open: s.nab,
    high: s.nab,
    low: s.nab,
    close: s.nab,
    volume: 0,
  }));
  const fund1y = returnN(nabs, 252);
  const ihsg1y = returnN(ihsg.map((b) => b.close), 252);
  const last = series[series.length - 1];
  const prev = series[series.length - 2] ?? last;
  return {
    meta,
    series,
    ret1m: returnN(nabs, 21),
    ret3m: returnN(nabs, 63),
    ret1y: fund1y,
    retYtd: ytdReturn(bars),
    vol: realizedVol(nabs, 60),
    dd: maxDrawdown(nabs),
    sharpe: sharpe(nabs),
    alpha1y: fund1y - ihsg1y,
    flow1d: last.flow,
    flow5d: series.slice(-5).reduce((s, p) => s + p.flow, 0),
    flow21d: series.slice(-21).reduce((s, p) => s + p.flow, 0),
    nabChangePct: last.nab / prev.nab - 1,
    expense: -meta.expenseRatio,
    aumLog: Math.log(last.aum),
  };
}

export function scoreFunds(raws: RawFund[]): ScoredFund[] {
  const byCat = new Map<FundCategory, RawFund[]>();
  for (const r of raws) {
    const list = byCat.get(r.meta.category) ?? [];
    list.push(r);
    byCat.set(r.meta.category, list);
  }
  const scored: ScoredFund[] = [];
  for (const [, group] of byCat) {
    scored.push(...scoreGroup(group));
  }
  return scored.sort((a, b) => b.score - a.score);
}

function scoreGroup(raws: RawFund[]): ScoredFund[] {
  const cat = raws[0]?.meta.category;
  const weights =
    cat === "pasar_uang"
      ? { ret1m: 0.22, ret1y: 0.18, sharpe: 0.12, dd: 0.18, vol: 0.12, aum: 0.1, expense: 0.08 }
      : cat === "obligasi"
        ? { ret1m: 0.14, ret1y: 0.18, sharpe: 0.2, dd: 0.16, vol: 0.08, aum: 0.12, expense: 0.12 }
        : { ret1m: 0.12, ret1y: 0.16, sharpe: 0.22, dd: 0.14, vol: 0.08, aum: 0.14, expense: 0.14 };

  const zRet1m = zScores(raws.map((r) => r.ret1m));
  const zRet1y = zScores(raws.map((r) => (cat === "saham" ? r.alpha1y : r.ret1y)));
  const zSharpe = zScores(raws.map((r) => r.sharpe));
  const zDd = zScores(raws.map((r) => r.dd));
  const zVol = zScores(raws.map((r) => -r.vol));
  const zAum = zScores(raws.map((r) => r.aumLog));
  const zExp = zScores(raws.map((r) => r.expense));

  return raws.map((r, i) => {
    const factors: Factor[] = [
      {
        key: "ret1m",
        label: "Imbal hasil 1 bulan",
        value: r.ret1m,
        display: pct(r.ret1m),
        z: zRet1m[i],
        weight: weights.ret1m,
        contribution: zRet1m[i] * weights.ret1m,
      },
      {
        key: "ret1y",
        label: cat === "saham" ? "Alpha 1 tahun vs IHSG" : "Imbal hasil 1 tahun",
        value: cat === "saham" ? r.alpha1y : r.ret1y,
        display: pct(cat === "saham" ? r.alpha1y : r.ret1y),
        z: zRet1y[i],
        weight: weights.ret1y,
        contribution: zRet1y[i] * weights.ret1y,
      },
      {
        key: "sharpe",
        label: "Sharpe (risk-adjusted)",
        value: r.sharpe,
        display: num(r.sharpe, 2),
        z: zSharpe[i],
        weight: weights.sharpe,
        contribution: zSharpe[i] * weights.sharpe,
      },
      {
        key: "dd",
        label: "Max drawdown (lebih dangkal lebih baik)",
        value: r.dd,
        display: pct(r.dd),
        z: zDd[i],
        weight: weights.dd,
        contribution: zDd[i] * weights.dd,
      },
      {
        key: "vol",
        label: "Volatilitas",
        value: r.vol,
        display: pct(r.vol, 1, false),
        z: zVol[i],
        weight: weights.vol,
        contribution: zVol[i] * weights.vol,
      },
      {
        key: "aum",
        label: "Dana kelolaan (AUM)",
        value: r.series[r.series.length - 1].aum,
        display: num(r.series[r.series.length - 1].aum, 0) + " M",
        z: zAum[i],
        weight: weights.aum,
        contribution: zAum[i] * weights.aum,
      },
      {
        key: "expense",
        label: "Expense ratio (lebih rendah lebih baik)",
        value: r.meta.expenseRatio,
        display: num(r.meta.expenseRatio, 2) + "%",
        z: zExp[i],
        weight: weights.expense,
        contribution: zExp[i] * weights.expense,
      },
    ];
    const contrib = factors.reduce((s, f) => s + f.contribution, 0);
    const score = Math.max(12, Math.min(95, 52 + 11 * contrib));
    const last = r.series[r.series.length - 1];
    return {
      id: r.meta.id,
      name: r.meta.name,
      mi: r.meta.mi,
      category: r.meta.category,
      custody: r.meta.custody,
      expenseRatio: r.meta.expenseRatio,
      risk: r.meta.risk,
      score,
      label: recLabel(score),
      nab: last.nab,
      nabChangePct: r.nabChangePct,
      aumMiliar: last.aum,
      ret1m: r.ret1m,
      ret3m: r.ret3m,
      ret1y: r.ret1y,
      retYtd: r.retYtd,
      volatility: r.vol,
      maxDrawdown: r.dd,
      sharpe: r.sharpe,
      alpha1y: r.alpha1y,
      flow1d: r.flow1d,
      flow5d: r.flow5d,
      flow21d: r.flow21d,
      spark: r.series.slice(-30).map((s) => s.nab),
      series: r.series,
      factors,
      insight: "",
      sourceNote:
        "NAB katalog kurasi, disimulasikan harian dengan model yang dikaitkan ke pergerakan IHSG (bukan NAB OJK resmi).",
    };
  });
}
