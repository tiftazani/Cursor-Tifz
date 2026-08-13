import type { Factor, ScoredFund, ScoredStock } from "../types";
import { num, pct } from "../format";

function topFactors(factors: Factor[], n = 2, dir: "pos" | "neg" = "pos"): Factor[] {
  const sorted = [...factors].sort((a, b) =>
    dir === "pos" ? b.contribution - a.contribution : a.contribution - b.contribution,
  );
  return sorted.slice(0, n);
}

export function narrateStock(stock: ScoredStock): string {
  const pos = topFactors(stock.factors, 2, "pos");
  const posText = pos.map((f) => `${f.label.toLowerCase()} ${f.display}`).join(" dan ");
  return `${stock.ticker} unggul hari ini dengan skor ${num(stock.score, 0)}. Penopang: ${posText}. Imbal hasil 1 bulan ${pct(stock.alpha1m)} dibanding IHSG.`;
}

export function narrateFund(fund: ScoredFund): string {
  const pos = topFactors(fund.factors, 2, "pos");
  const posText = pos.map((f) => `${f.label.toLowerCase()} ${f.display}`).join(" dan ");
  const cat =
    fund.category === "pasar_uang" ? "pasar uang" : fund.category === "saham" ? "saham" : "obligasi";
  return `${fund.name} menjadi pilihan ${cat} hari ini (skor ${num(fund.score, 0)}). Penopang: ${posText}.`;
}
