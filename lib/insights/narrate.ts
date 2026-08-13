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
  const neg = topFactors(stock.factors, 1, "neg")[0];
  const posText = pos.map((f) => `${f.label.toLowerCase()} ${f.display}`).join(" dan ");
  const caution = neg && neg.contribution < 0 ? ` Catatan: ${neg.label.toLowerCase()} ${neg.display} menahan skor.` : "";
  return `${stock.ticker} mencetak Cuan Score ${num(stock.score, 0)} (${stock.label}) karena ${posText}. Alpha 1 bulan ${pct(stock.alpha1m)} vs IHSG, RSI ${num(stock.rsi, 0)}.${caution}`;
}

export function narrateFund(fund: ScoredFund): string {
  const pos = topFactors(fund.factors, 2, "pos");
  const posText = pos.map((f) => `${f.label.toLowerCase()} ${f.display}`).join(" serta ");
  const cat =
    fund.category === "pasar_uang"
      ? "pasar uang"
      : fund.category === "saham"
        ? "saham"
        : "obligasi";
  return `${fund.name} unggul di kategori ${cat} dengan skor ${num(fund.score, 0)} (${fund.label}). Penopang: ${posText}. AUM ${num(fund.aumMiliar, 0)} miliar, expense ${num(fund.expenseRatio, 2)}%.`;
}
