import universe from "@/data/stocks-universe.json";
import type { StockMeta } from "../types";

const ALIASES: Record<string, string> = {
  BCA: "BBCA",
  BRI: "BBRI",
  MANDIRI: "BMRI",
  BNI: "BBNI",
  BSI: "BRIS",
  TELKOM: "TLKM",
  ASTRA: "ASII",
  ADARO: "ADRO",
  ANTAM: "ANTM",
  UNILEVER: "UNVR",
  KALBE: "KLBF",
  GOJEK: "GOTO",
  TOKOPEDIA: "GOTO",
  BUKALAPAK: "BUKA",
  ALFAMART: "AMRT",
  INDOCEMENT: "INTP",
  SEMEN: "SMGR",
  INDOSAT: "ISAT",
  XL: "EXCL",
  AXIATA: "EXCL",
  VALE: "INCO",
  NICKEL: "INCO",
  PGN: "PGAS",
  MEDCO: "MEDC",
  UNTRAC: "UNTR",
  TRACTORS: "UNTR",
  MAYORA: "MYOR",
  CHAROEN: "CPIN",
  JAPFA: "JPFA",
  GUDANG: "GGRM",
  SAMPOERNA: "HMSP",
  CHANDRA: "TPIA",
  BARITO: "BRPT",
  AMMAN: "AMMN",
  MERDEKA: "MDKA",
  BUKIT: "PTBA",
  ITMG: "ITMG",
};

const stocks = universe as StockMeta[];

export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\.JK$/i, "").replace(/,/g, " ").replace(/\s+/g, " ");
}

export function tickerCode(raw: string): string | null {
  const compact = normalizeQuery(raw).replace(/[\s.-]/g, "").toUpperCase();
  if (!/^[A-Z]{4}$/.test(compact)) return null;
  return ALIASES[compact] ?? compact;
}

export function matchUniverse(query: string): StockMeta | null {
  const q = normalizeQuery(query);
  if (!q) return null;
  const code = tickerCode(q);
  if (code) {
    return stocks.find((s) => s.ticker === code) ?? null;
  }

  const lower = q.toLowerCase();
  const tokens = lower.split(" ").filter((t) => t.length > 2);
  if (tokens.length) {
    const hit = stocks.find((s) => {
      const hay = `${s.ticker} ${s.name}`.toLowerCase();
      return tokens.every((t) => wholeToken(hay, t));
    });
    if (hit) return hit;
  }

  return stocks.find((s) => wholeToken(s.name.toLowerCase(), lower)) ?? null;
}

export function looksLikeTicker(query: string): boolean {
  return tickerCode(query) != null;
}

function wholeToken(hay: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(hay);
}
