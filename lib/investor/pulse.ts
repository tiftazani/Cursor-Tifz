import type { FundCategory, InvestorPulse, ScoredFund, ScoredStock } from "../types";
import { pct } from "../format";

export function buildInvestorPulse(stocks: ScoredStock[], funds: ScoredFund[]): InvestorPulse {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let largeRet = 0;
  let largeN = 0;
  let smallRet = 0;
  let smallN = 0;
  let volSum = 0;
  let avgVolSum = 0;

  for (const s of stocks) {
    if (s.changePct > 0.001) advancing += 1;
    else if (s.changePct < -0.001) declining += 1;
    else unchanged += 1;
    volSum += s.volume;
    avgVolSum += s.avgVolume20;
    if (s.cap === "large") {
      largeRet += s.changePct;
      largeN += 1;
    } else {
      smallRet += s.changePct;
      smallN += 1;
    }
  }

  const largeCapRet = largeN ? largeRet / largeN : 0;
  const smallCapRet = smallN ? smallRet / smallN : 0;
  const volumeVsAvg = avgVolSum ? volSum / avgVolSum : 1;
  const breadthPct = stocks.length ? (advancing - declining) / stocks.length : 0;

  const cats: FundCategory[] = ["pasar_uang", "saham", "obligasi"];
  const fundFlowByCategory = cats.map((category) => {
    const list = funds.filter((f) => f.category === category);
    const flowMiliar = list.reduce((s, f) => s + f.flow1d, 0);
    const ret1d = list.length ? list.reduce((s, f) => s + f.nabChangePct, 0) / list.length : 0;
    return { category, flowMiliar, ret1d };
  });

  let styleBias = "Netral large vs small cap";
  if (largeCapRet - smallCapRet > 0.004) styleBias = "Rotasi ke large cap / blue chip";
  else if (smallCapRet - largeCapRet > 0.004) styleBias = "Selera risiko ke mid-small cap";

  const narrative: string[] = [];
  if (breadthPct > 0.15) {
    narrative.push(`Breadth positif: ${advancing} emiten naik vs ${declining} turun di universe likuid Cuan.`);
  } else if (breadthPct < -0.15) {
    narrative.push(`Breadth negatif: ${declining} emiten turun vs ${advancing} naik — tekanan cukup merata.`);
  } else {
    narrative.push(`Breadth campuran (${advancing} naik / ${declining} turun). Pergerakan masih selektif.`);
  }
  narrative.push(
    `Volume universe ${pct(volumeVsAvg - 1)} vs rata-rata 20 hari. ${styleBias} (large ${pct(largeCapRet)}, others ${pct(smallCapRet)}).`,
  );
  const flowSaham = fundFlowByCategory.find((f) => f.category === "saham");
  const flowPu = fundFlowByCategory.find((f) => f.category === "pasar_uang");
  if (flowSaham && flowPu) {
    if (flowSaham.flowMiliar > 0 && flowPu.flowMiliar < 0) {
      narrative.push("Estimasi aliran reksadana: dana masuk ke RD saham, sedikit keluar dari pasar uang — selera risiko naik.");
    } else if (flowSaham.flowMiliar < 0 && flowPu.flowMiliar > 0) {
      narrative.push("Estimasi aliran reksadana: rotasi ke pasar uang (risk-off) saat RD saham mencatat outflow.");
    } else {
      narrative.push(
        `Estimasi aliran: RD saham ${flowSaham.flowMiliar >= 0 ? "inflow" : "outflow"} ${Math.abs(flowSaham.flowMiliar).toFixed(0)} M, RDPU ${flowPu.flowMiliar >= 0 ? "inflow" : "outflow"} ${Math.abs(flowPu.flowMiliar).toFixed(0)} M.`,
      );
    }
  }

  return {
    advancing,
    declining,
    unchanged,
    breadthPct,
    volumeVsAvg,
    largeCapRet,
    smallCapRet,
    styleBias,
    fundFlowByCategory,
    narrative,
    methodology:
      "Bukan data KSEI/IDX foreign flow resmi. Breadth & volume dihitung dari universe 42 emiten likuid. Aliran reksadana diestimasi dari ΔAUM dikurangi return NAB (metode klasik flow).",
  };
}
