import { getDailySnapshot } from "../snapshot";
import { fetchChart, fetchQuotes } from "../market/yahoo";
import { getTickerNews } from "../news";
import { compactShares, idr, num, pct } from "../format";
import {
  alignReturn,
  macdHistogram,
  maxDrawdown,
  mean,
  pctChange,
  realizedVol,
  returnN,
  rsi,
  sma,
  ytdReturn,
} from "../indicators";
import { recLabel } from "../scoring/stocks";
import type { Bar, RecLabel, ScoredStock } from "../types";
import { EMITEN_NOT_FOUND } from "./copy";
import { commodityFocus, getGlobalMarkets, type MarketPrint } from "./markets";
import { looksLikeTicker, matchUniverse, tickerCode } from "./resolve";

export type AnalyzeResult = {
  found: boolean;
  text: string;
  ticker?: string;
};

export async function analyzeEmiten(rawQuery: string): Promise<AnalyzeResult> {
  const query = rawQuery.trim();
  if (!query) {
    return { found: false, text: EMITEN_NOT_FOUND };
  }

  const uni = matchUniverse(query);
  const code = uni?.ticker ?? tickerCode(query);
  if (!uni && !looksLikeTicker(query)) {
    return { found: false, text: EMITEN_NOT_FOUND };
  }
  if (!code) {
    return { found: false, text: EMITEN_NOT_FOUND };
  }

  const symbol = `${code}.JK`;
  const [snap, quotes, bars, markets] = await Promise.all([
    getDailySnapshot().catch(() => null),
    fetchQuotes([symbol]),
    fetchChart(symbol, "1y"),
    getGlobalMarkets(),
  ]);

  const scored = snap?.stocks.find((s) => s.ticker === code) ?? null;
  const quote = quotes.get(symbol);
  const liveBars = bars ?? scored?.bars ?? null;

  if (!scored && !quote && !liveBars && !uni) {
    return { found: false, text: EMITEN_NOT_FOUND };
  }

  const name = scored?.name ?? uni?.name ?? quote?.name ?? code;
  const sector = scored?.sector ?? uni?.sector ?? "Saham BEI";
  const news = await getTickerNews(code, name).catch(() => []);

  const text = buildReport({
    ticker: code,
    name,
    sector,
    scored,
    quotePrice: quote?.price ?? uni?.lastPrice,
    quoteChange: quote?.changePct,
    quotePe: quote?.pe ?? scored?.pe ?? null,
    quotePb: quote?.pb ?? scored?.pb ?? null,
    bars: liveBars ?? [],
    ihsg: snap?.ihsg.bars ?? [],
    ihsgLast: snap?.ihsg.last ?? 0,
    ihsgChange: snap?.ihsg.changePct ?? 0,
    markets,
    news: news.map((n) => n.title),
  });

  return { found: true, text, ticker: scored ? code : undefined };
}

type ReportInput = {
  ticker: string;
  name: string;
  sector: string;
  scored: ScoredStock | null;
  quotePrice?: number;
  quoteChange?: number;
  quotePe: number | null;
  quotePb: number | null;
  bars: Bar[];
  ihsg: Bar[];
  ihsgLast: number;
  ihsgChange: number;
  markets: MarketPrint[];
  news: string[];
};

function buildReport(input: ReportInput): string {
  const closes = input.bars.map((b) => b.close);
  const lastBar = input.bars[input.bars.length - 1];
  const prevBar = input.bars[input.bars.length - 2] ?? lastBar;
  const price = input.quotePrice ?? input.scored?.price ?? lastBar?.close ?? 0;
  const change = input.quoteChange ?? input.scored?.changePct ?? (lastBar && prevBar ? pctChange(prevBar.close, lastBar.close) : 0);
  const rsiVal = input.scored?.rsi ?? (closes.length ? rsi(closes) : 50);
  const ma20 = input.scored?.ma20 ?? (closes.length ? sma(closes, 20) : price);
  const ma50 = input.scored?.ma50 ?? (closes.length ? sma(closes, 50) : price);
  const macd = closes.length ? macdHistogram(closes) : 0;
  const vol = lastBar?.volume ?? input.scored?.volume ?? 0;
  const avgVol = input.scored?.avgVolume20 ?? mean(input.bars.slice(-20).map((b) => b.volume));
  const volRatio = avgVol ? vol / avgVol : input.scored?.volumeRatio ?? 1;
  const weekHigh = input.scored?.week52High ?? Math.max(...input.bars.slice(-252).map((b) => b.high), price);
  const weekLow = input.scored?.week52Low ?? Math.min(...input.bars.slice(-252).map((b) => b.low), price);
  const pos52 = weekHigh === weekLow ? 0.5 : (price - weekLow) / (weekHigh - weekLow);
  const ret1m = input.scored?.ret1m ?? (closes.length ? returnN(closes, 21) : 0);
  const ret3m = input.scored?.ret3m ?? (closes.length ? returnN(closes, 63) : 0);
  const retYtd = input.scored?.retYtd ?? (input.bars.length ? ytdReturn(input.bars) : 0);
  const aligned = input.bars.length && input.ihsg.length ? alignReturn(input.bars, input.ihsg, 21) : { a: ret1m, b: 0 };
  const alpha1m = input.scored?.alpha1m ?? aligned.a - aligned.b;
  const dd = closes.length ? maxDrawdown(closes.slice(-120)) : 0;
  const volAnn = input.scored?.volatility ?? (closes.length ? realizedVol(closes, 30) : 0);
  const recent = input.bars.slice(-20);
  const support = recent.length ? Math.min(...recent.map((b) => b.low)) : price * 0.97;
  const resist = recent.length ? Math.max(...recent.map((b) => b.high)) : price * 1.03;

  let score = input.scored?.score ?? technicalScore(price, ma20, ma50, rsiVal, macd, volRatio, alpha1m, pos52);
  const focus = commodityFocus(input.sector, input.ticker);
  const relevant = input.markets.filter((m) => focus.includes(m.group));
  const tailwind = commodityBias(relevant);
  score = clamp(score + tailwind * 4 + globalBias(input.markets) * 3, 8, 96);
  const label: RecLabel = input.scored?.label ?? recLabel(score);

  const trend =
    price > ma20 && ma20 >= ma50
      ? "tren naik (harga di atas MA20 dan MA50)"
      : price < ma20 && ma20 <= ma50
        ? "tren turun (harga di bawah MA20 dan MA50)"
        : "tren sideways / transisi";

  const rsiText =
    rsiVal >= 70
      ? `RSI ${num(rsiVal, 0)} — jenuh beli, risiko koreksi naik.`
      : rsiVal <= 30
        ? `RSI ${num(rsiVal, 0)} — jenuh jual, peluang rebound teknis.`
        : `RSI ${num(rsiVal, 0)} — momentum masih wajar.`;

  const macdText = macd >= 0 ? "MACD histogram positif (pembelian masih mendominasi)." : "MACD histogram negatif (tekanan jual masih ada).";
  const volText =
    volRatio >= 1.3
      ? `Volume ${num(volRatio, 2)}x rata-rata 20 hari — ada konfirmasi pergerakan.`
      : volRatio <= 0.7
        ? `Volume ${num(volRatio, 2)}x rata-rata — masih sepi, breakout kurang meyakinkan.`
        : `Volume ${num(volRatio, 2)}x rata-rata — likuiditas normal.`;

  const lines: string[] = [];
  lines.push(`${input.ticker} — ${input.name}`);
  lines.push(
    `Harga ${idr(price)} (${signedPct(change)} hari ini). Sektor ${input.sector}. Skor analisa ${num(score, 0)} · ${label}.`,
  );
  lines.push(
    `Teknikal: ${trend}. ${rsiText} ${macdText} ${volText} Posisi ${pct(pos52, 0, false)} dari rentang 52 minggu (${idr(weekLow)}–${idr(weekHigh)}). Support dekat ${idr(support)}, resistensi ${idr(resist)}.`,
  );
  lines.push(
    `Kinerja: 1 bulan ${signedPct(ret1m)}, 3 bulan ${signedPct(ret3m)}, YTD ${signedPct(retYtd)}. Alpha vs IHSG 1 bulan ${signedPct(alpha1m)}. Volatilitas tahunan ${pct(volAnn, 1, false)}, penurunan terdalam 6 bulan ${pct(dd)}.`,
  );

  if (input.quotePe || input.quotePb) {
    const bits = [
      input.quotePe ? `P/E ${num(input.quotePe, 1)}x` : null,
      input.quotePb ? `P/B ${num(input.quotePb, 2)}x` : null,
    ].filter(Boolean);
    lines.push(`Valuasi: ${bits.join(", ")}.`);
  }

  const ihsgBit =
    input.ihsgLast > 0
      ? `IHSG ${num(input.ihsgLast, 2)} (${signedPct(input.ihsgChange)}).`
      : "Data IHSG terbatas saat ini.";
  lines.push(`Pasar domestik: ${ihsgBit} ${relativeVsIndex(alpha1m, input.ticker)}`);

  lines.push(globalParagraph(input.markets, input.sector));
  lines.push(commodityParagraph(relevant, input.sector, input.ticker, input.markets));

  if (input.news.length) {
    lines.push(`Berita terkait:\n${input.news.map((n) => `• ${n}`).join("\n")}`);
  } else {
    lines.push("Berita khusus emiten ini sedang sepi di sumber yang kami pantau. Fokus ke teknikal dan harga komoditas/global.");
  }

  lines.push(conclusion(label, trend, tailwind, globalBias(input.markets), input.ticker, volRatio));
  if (vol) lines.push(`Volume sesi: ${compactShares(vol)} saham.`);
  return lines.join("\n\n");
}

function technicalScore(
  price: number,
  ma20: number,
  ma50: number,
  rsiVal: number,
  macd: number,
  volRatio: number,
  alpha1m: number,
  pos52: number,
): number {
  let s = 50;
  if (price > ma20) s += 8;
  else s -= 6;
  if (ma20 >= ma50) s += 8;
  else s -= 5;
  if (macd > 0) s += 6;
  else s -= 4;
  if (rsiVal >= 45 && rsiVal <= 68) s += 6;
  else if (rsiVal > 75) s -= 8;
  else if (rsiVal < 30) s += 2;
  if (volRatio > 1.2) s += 5;
  if (alpha1m > 0.01) s += 8;
  else if (alpha1m < -0.01) s -= 6;
  if (pos52 > 0.75) s += 2;
  if (pos52 < 0.25) s -= 4;
  return clamp(s, 8, 96);
}

function commodityBias(items: MarketPrint[]): number {
  if (!items.length) return 0;
  const avg = mean(items.map((i) => i.changePct));
  if (avg > 0.008) return 1;
  if (avg < -0.008) return -1;
  return 0;
}

function globalBias(markets: MarketPrint[]): number {
  const sp = markets.find((m) => m.symbol === "^GSPC");
  if (!sp) return 0;
  if (sp.changePct > 0.006) return 1;
  if (sp.changePct < -0.008) return -1;
  return 0;
}

function globalParagraph(markets: MarketPrint[], sector: string): string {
  const pick = (sym: string) => markets.find((m) => m.symbol === sym);
  const sp = pick("^GSPC");
  const nq = pick("^IXIC");
  const nk = pick("^N225");
  const fx = pick("USDIDR=X");
  const parts = [
    sp ? `S&P 500 ${signedPct(sp.changePct)}` : null,
    nq ? `Nasdaq ${signedPct(nq.changePct)}` : null,
    nk ? `Nikkei ${signedPct(nk.changePct)}` : null,
    fx ? `USD/IDR ${num(fx.price, 0)} (${signedPct(fx.changePct)})` : null,
  ].filter(Boolean);
  if (!parts.length) {
    return "Pasar global: data luar negeri belum tersedia saat ini.";
  }
  let tone = "Sentimen luar negeri campuran.";
  if (sp && sp.changePct < -0.008) tone = "Wall Street sedang tertekan — saham beta tinggi di BEI biasanya ikut hati-hati.";
  else if (sp && sp.changePct > 0.006) tone = "Wall Street positif — selera risiko global mendukung IHSG.";
  if (fx && fx.changePct > 0.006 && sector === "Perbankan") {
    tone += " Rupiah melemah; perbankan large-cap biasanya lebih tahan, tapi valuasi bisa tertekan.";
  } else if (fx && fx.changePct < -0.004 && sector === "Perbankan") {
    tone += " Rupiah menguat; ini umumnya nyaman untuk bank dan importir.";
  }
  if (sector === "Teknologi" && nq) {
    tone += nq.changePct < 0 ? " Nasdaq lemah menahan saham teknologi lokal." : " Nasdaq kuat memberi angin untuk saham teknologi.";
  }
  return `Pasar global: ${parts.join(", ")}. ${tone}`;
}

function commodityParagraph(
  relevant: MarketPrint[],
  sector: string,
  ticker: string,
  all: MarketPrint[],
): string {
  const use = relevant.length ? relevant : all.filter((m) => m.group === "energy" || m.group === "metal");
  if (!use.length) {
    return "Komoditas: data harga komoditas belum masuk. Analisa memakai teknikal dan IHSG.";
  }
  const bits = use.map((m) => `${m.label} ${signedPct(m.changePct)}`);
  const avg = mean(use.map((m) => m.changePct));
  let link = "Dampak ke emiten ini netral-campuran.";
  if (["ADRO", "PTBA", "ITMG", "UNTR"].includes(ticker)) {
    link = avg > 0 ? "Harga energi/logam naik — mendukung emiten batu bara dan kontraktor tambang." : "Harga energi lunak — tekan sentimen batu bara.";
  } else if (["ANTM", "INCO", "MDKA", "AMMN"].includes(ticker)) {
    link = avg > 0 ? "Logam menguat — mendukung emiten nikel, emas, dan tembaga." : "Logam melemah — hati-hati untuk emiten tambang mineral.";
  } else if (["MEDC", "PGAS", "ESSA"].includes(ticker)) {
    link = avg > 0 ? "Minyak/gas naik — pendukung untuk emiten energi." : "Minyak/gas turun — tekan ekspektasi pendapatan energi.";
  } else if (["CPIN", "JPFA", "ICBP", "INDF", "MYOR"].includes(ticker)) {
    link = avg > 0 ? "Bahan pangan/energi naik bisa menekan margin produsen makanan." : "Bahan baku lebih lunak — potensi margin lebih nyaman.";
  } else if (sector === "Perbankan" || sector === "Teknologi" || sector === "Telekomunikasi") {
    link = "Emiten ini tidak langsung terikat harga komoditas; yang lebih penting adalah USD/IDR dan selera risiko global.";
  }
  return `Komoditas: ${bits.join(", ")}. ${link}`;
}

function relativeVsIndex(alpha1m: number, ticker: string): string {
  if (alpha1m > 0.01) return `${ticker} lebih kuat dari IHSG dalam sebulan terakhir.`;
  if (alpha1m < -0.01) return `${ticker} tertinggal dari IHSG dalam sebulan terakhir.`;
  return `${ticker} bergerak seirama dengan IHSG.`;
}

function conclusion(
  label: RecLabel,
  trend: string,
  commodity: number,
  global: number,
  ticker: string,
  volRatio: number,
): string {
  if (label === "Beli") {
    return `Kesimpulan: ${ticker} layak jadi kandidat akumulasi. ${trend}, ${commodity >= 0 ? "komoditas/global tidak menahan" : "meski komoditas/global agak menahan"}, dan likuiditas ${volRatio >= 1 ? "mendukung" : "perlu ditunggu lebih ramai"}.`;
  }
  if (label === "Waspada") {
    return `Kesimpulan: ${ticker} masih rawan. Tunggu sinyal teknikal membaik atau harga mendekati support sebelum masuk.`;
  }
  return `Kesimpulan: ${ticker} lebih cocok ditahan / dipantau. Belum ada kombinasi teknikal, global, dan komoditas yang cukup tegas untuk dorongan kuat.`;
}

function signedPct(value: number): string {
  return pct(value);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
