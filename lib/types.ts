export type CapBucket = "large" | "mid" | "small";
export type FundCategory = "pasar_uang" | "saham" | "obligasi";
export type RecLabel = "Beli" | "Tahan" | "Waspada";
export type DataSource = "live" | "cache" | "fallback" | "mixed";
export type MarketStatus = "open" | "closed" | "weekend";

export type StockMeta = {
  ticker: string;
  name: string;
  sector: string;
  cap: CapBucket;
  beta: number;
  lastPrice: number;
};

export type FundMeta = {
  id: string;
  name: string;
  mi: string;
  category: FundCategory;
  custody: string;
  expenseRatio: number;
  aumMiliar: number;
  risk: "rendah" | "sedang" | "tinggi";
  beta: number;
  alphaAnn: number;
  volAnn: number;
  yieldAnn: number;
  durationYears: number;
};

export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Factor = {
  key: string;
  label: string;
  value: number;
  display: string;
  z: number;
  weight: number;
  contribution: number;
};

export type ScoredStock = {
  ticker: string;
  yahooSymbol: string;
  name: string;
  sector: string;
  cap: CapBucket;
  score: number;
  label: RecLabel;
  price: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  avgVolume20: number;
  volumeRatio: number;
  week52High: number;
  week52Low: number;
  pe: number | null;
  pb: number | null;
  marketCap: number | null;
  ret1m: number;
  ret3m: number;
  retYtd: number;
  alpha1m: number;
  alpha3m: number;
  volatility: number;
  rsi: number;
  ma20: number;
  ma50: number;
  spark: number[];
  bars: Bar[];
  factors: Factor[];
  insight: string;
  dataQuality: "full" | "partial" | "synthetic";
};

export type FundPoint = {
  date: string;
  nab: number;
  aum: number;
  flow: number;
};

export type ScoredFund = {
  id: string;
  name: string;
  mi: string;
  category: FundCategory;
  custody: string;
  expenseRatio: number;
  risk: FundMeta["risk"];
  score: number;
  label: RecLabel;
  nab: number;
  nabChangePct: number;
  aumMiliar: number;
  ret1m: number;
  ret3m: number;
  ret1y: number;
  retYtd: number;
  volatility: number;
  maxDrawdown: number;
  sharpe: number;
  alpha1y: number;
  flow1d: number;
  flow5d: number;
  flow21d: number;
  spark: number[];
  series: FundPoint[];
  factors: Factor[];
  insight: string;
  sourceNote: string;
};

export type InvestorPulse = {
  advancing: number;
  declining: number;
  unchanged: number;
  breadthPct: number;
  volumeVsAvg: number;
  largeCapRet: number;
  smallCapRet: number;
  styleBias: string;
  fundFlowByCategory: { category: FundCategory; flowMiliar: number; ret1d: number }[];
  narrative: string[];
  methodology: string;
};

export type TrackPoint = {
  date: string;
  tickers: string[];
  pickRet1d: number;
  ihsgRet1d: number;
  alpha1d: number;
  pickRet5d: number | null;
  ihsgRet5d: number | null;
  alpha5d: number | null;
  hit: boolean;
};

export type AnalyticsPayload = {
  ihsgSeries: { date: string; value: number }[];
  picksSeries: { date: string; picks: number; ihsg: number }[];
  drawdown: { date: string; dd: number }[];
  sectorHeatmap: { sector: string; changePct: number; avgScore: number; count: number }[];
  scatter: { ticker: string; name: string; vol: number; ret1m: number; score: number; sector: string }[];
  scoreBuckets: { bucket: string; count: number }[];
  trackRecord: TrackPoint[];
  summary: {
    hitRate: number;
    avgAlpha1d: number;
    avgAlpha5d: number;
    picksVsIhsg30d: number;
  };
};

export type DailySnapshot = {
  asOf: string;
  asOfWib: string;
  generatedAt: string;
  stale: boolean;
  source: DataSource;
  marketStatus: MarketStatus;
  ihsg: {
    last: number;
    prev: number;
    changePct: number;
    high: number;
    low: number;
    open: number;
    spark: number[];
    bars: Bar[];
    ret1m: number;
    ret3m: number;
    retYtd: number;
  };
  stocks: ScoredStock[];
  stockPicks: ScoredStock[];
  funds: ScoredFund[];
  fundPicks: Record<FundCategory, ScoredFund>;
  investor: InvestorPulse;
  analytics: AnalyticsPayload;
  notes: string[];
};
