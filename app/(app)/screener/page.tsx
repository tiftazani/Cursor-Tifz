import { getDailySnapshot } from "@/lib/snapshot";
import { ScreenerClient } from "./screener-client";
import { PageHeader } from "@/components/ui";
import { StaleBanner } from "@/components/stale-banner";

export const metadata = { title: "Screener" };

export default async function ScreenerPage() {
  const snap = await getDailySnapshot();
  const rows = snap.stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    score: s.score,
    label: s.label,
    price: s.price,
    changePct: s.changePct,
    ret1m: s.ret1m,
    volumeRatio: s.volumeRatio,
    pe: s.pe,
    rsi: s.rsi,
  }));
  const sectors = [...new Set(snap.stocks.map((s) => s.sector))].sort();
  return (
    <div>
      <PageHeader
        kicker="Filter"
        title="Screener saham"
        subtitle="Saring universe Cuan berdasarkan sektor, skor minimum, momentum 1 bulan, dan likuiditas."
      />
      <StaleBanner stale={snap.stale} notes={snap.notes} />
      <ScreenerClient rows={rows} sectors={sectors} />
    </div>
  );
}
