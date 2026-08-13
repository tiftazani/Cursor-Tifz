import { getDailySnapshot } from "@/lib/snapshot";
import { PageHeader } from "@/components/ui";
import { WatchlistClient } from "./watchlist-client";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const snap = await getDailySnapshot();
  const rows = snap.stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    score: s.score,
    label: s.label,
    price: s.price,
    changePct: s.changePct,
    insight: s.insight,
  }));
  return (
    <div>
      <PageHeader
        kicker="Lokal"
        title="Watchlist"
        subtitle="Disimpan di browser (localStorage). Bandingkan emiten pantauan dengan Cuan Score hari ini."
      />
      <WatchlistClient rows={rows} />
    </div>
  );
}
