export type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  tag: "Saham" | "Reksadana" | "Pasar";
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FEEDS: { url: string; source: string }[] = [
  { url: "https://www.cnbcindonesia.com/market/rss", source: "CNBC Indonesia" },
  { url: "https://www.cnbcindonesia.com/investment/rss", source: "CNBC Indonesia" },
  {
    url: "https://news.google.com/rss/search?q=IHSG+when:1d&hl=id&gl=ID&ceid=ID:id",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=reksadana+OR+%22reksa+dana%22+when:2d&hl=id&gl=ID&ceid=ID:id",
    source: "Google News",
  },
];

let cache: { at: number; items: NewsItem[] } | null = null;

export async function getMarketNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < 15 * 60 * 1000) return cache.items;
  const lists = await Promise.all(FEEDS.map((f) => fetchRss(f.url, f.source)));
  const merged = dedupe(lists.flat()).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  const items = merged.slice(0, 12);
  cache = { at: Date.now(), items };
  return items;
}

export async function getTickerNews(ticker: string, name: string): Promise<NewsItem[]> {
  const q = encodeURIComponent(`${ticker} OR "${name}" saham when:5d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=id&gl=ID&ceid=ID:id`;
  const items = await fetchRss(url, "Google News");
  return dedupe(items).slice(0, 4);
}

async function fetchRss(url: string, fallbackSource: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const chunks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
    return chunks
      .map((chunk) => {
        const title = decode(strip(pick(chunk, "title")));
        const link = strip(pick(chunk, "link")) || extractHref(chunk);
        const pub = pick(chunk, "pubDate") || pick(chunk, "published");
        const source =
          strip(pick(chunk, "source")) ||
          strip(pick(chunk, "dc:creator")) ||
          fallbackSource;
        if (!title || !link) return null;
        return {
          title,
          source: cleanSource(source, fallbackSource),
          url: link,
          publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
          tag: tagOf(title),
        } satisfies NewsItem;
      })
      .filter((x): x is NewsItem => Boolean(x));
  } catch {
    return [];
  }
}

function pick(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
    ?? xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1]?.trim() ?? "";
}

function extractHref(xml: string): string {
  const m = xml.match(/<link[^>]+href="([^"]+)"/i);
  return m?.[1] ?? "";
}

function strip(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function tagOf(title: string): NewsItem["tag"] {
  const t = title.toLowerCase();
  if (/reksa\s?dana|nab|manajer investasi|pasar uang/.test(t)) return "Reksadana";
  if (/ihsg|bursa|saham|emiten|idx|lq45/.test(t)) return "Saham";
  return "Pasar";
}

function cleanSource(source: string, fallback: string): string {
  const s = source.replace(/ - Google News$/i, "").trim();
  if (!s || s === "Google News") return fallback;
  return s;
}

function dedupe(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of items) {
    const key = item.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
