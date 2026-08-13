import { fetchQuotes, type YahooQuote } from "../market/yahoo";

export type MarketPrint = {
  symbol: string;
  label: string;
  group: "global" | "fx" | "energy" | "metal" | "agri";
  price: number;
  changePct: number;
};

const WATCH: { symbol: string; label: string; group: MarketPrint["group"] }[] = [
  { symbol: "^GSPC", label: "S&P 500", group: "global" },
  { symbol: "^IXIC", label: "Nasdaq", group: "global" },
  { symbol: "^N225", label: "Nikkei", group: "global" },
  { symbol: "USDIDR=X", label: "USD/IDR", group: "fx" },
  { symbol: "CL=F", label: "Minyak WTI", group: "energy" },
  { symbol: "BZ=F", label: "Minyak Brent", group: "energy" },
  { symbol: "NG=F", label: "Gas alam", group: "energy" },
  { symbol: "GC=F", label: "Emas", group: "metal" },
  { symbol: "SI=F", label: "Perak", group: "metal" },
  { symbol: "HG=F", label: "Tembaga", group: "metal" },
  { symbol: "KC=F", label: "Kopi", group: "agri" },
  { symbol: "ZW=F", label: "Gandum", group: "agri" },
];

let cache: { at: number; items: MarketPrint[] } | null = null;

export async function getGlobalMarkets(): Promise<MarketPrint[]> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.items;
  const quotes = await fetchQuotes(WATCH.map((w) => w.symbol));
  const items = WATCH.map((w) => toPrint(w, quotes.get(w.symbol))).filter((x): x is MarketPrint => Boolean(x));
  cache = { at: Date.now(), items };
  return items;
}

function toPrint(
  spec: (typeof WATCH)[number],
  quote: YahooQuote | undefined,
): MarketPrint | null {
  if (!quote) return null;
  return {
    symbol: spec.symbol,
    label: spec.label,
    group: spec.group,
    price: quote.price,
    changePct: quote.changePct,
  };
}

export function commodityFocus(sector: string, ticker: string): MarketPrint["group"][] {
  const t = ticker.toUpperCase();
  if (["ADRO", "PTBA", "ITMG", "UNTR"].includes(t)) return ["energy", "metal"];
  if (["ANTM", "INCO", "MDKA", "AMMN"].includes(t)) return ["metal"];
  if (["MEDC", "PGAS", "PGEO", "ESSA"].includes(t)) return ["energy"];
  if (["CPIN", "JPFA", "ICBP", "INDF", "MYOR", "UNVR"].includes(t)) return ["agri", "energy"];
  if (["ASII", "SMGR", "INTP", "TPIA", "BRPT"].includes(t)) return ["energy", "metal"];
  if (sector === "Pertambangan") return ["metal", "energy"];
  if (sector === "Energi") return ["energy"];
  if (sector === "Teknologi") return ["global"];
  if (sector === "Perbankan") return ["fx", "global"];
  return ["global", "fx"];
}
