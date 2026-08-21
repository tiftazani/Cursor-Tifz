import { notFound } from "next/navigation";
import { getDailySnapshot } from "@/lib/snapshot";
import { compactShares, idr, num, pct } from "@/lib/format";
import { Card, Change, LabelBadge, LiveBadge, PageHeader, ScorePill, Stat } from "@/components/ui";
import { PriceChart } from "@/components/charts";
import { FactorList } from "@/components/factor-list";
import { WatchButton } from "@/components/watchlist";
import { Disclaimer } from "@/components/disclaimer";
import { formatWibClock } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: ticker.toUpperCase() };
}

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const snap = await getDailySnapshot();
  const stock = snap.stocks.find((s) => s.ticker === ticker.toUpperCase());
  if (!stock) notFound();

  return (
    <div>
      <PageHeader
        kicker={stock.sector}
        title={`${stock.ticker} · ${stock.name}`}
        subtitle={stock.insight}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <LabelBadge label={stock.label} />
        <span className="text-sm text-mute">
          Cuan Score <ScorePill score={stock.score} />
        </span>
        <WatchButton ticker={stock.ticker} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="num text-3xl font-semibold">{idr(stock.price)}</p>
              <Change value={stock.changePct} />
            </div>
            <LiveBadge
              marketStatus={snap.marketStatus}
              stale={snap.stale}
              clock={formatWibClock(snap.generatedAt)}
            />
          </div>
          <PriceChart
            data={stock.bars.map((b) => ({ date: b.date, value: b.close }))}
            color={stock.changePct >= 0 ? "#9cba8a" : "#d46a6a"}
          />
        </Card>
        <Card className="grid grid-cols-2 gap-4">
          <Stat label="Open" value={idr(stock.open)} />
          <Stat label="High" value={idr(stock.high)} />
          <Stat label="Low" value={idr(stock.low)} />
          <Stat label="Volume" value={compactShares(stock.volume)} hint={`${num(stock.volumeRatio, 2)}x avg`} />
          <Stat label="P/E" value={stock.pe ? num(stock.pe, 1) : "n/a"} />
          <Stat label="P/B" value={stock.pb ? num(stock.pb, 2) : "n/a"} />
          <Stat label="52w high" value={idr(stock.week52High)} />
          <Stat label="52w low" value={idr(stock.week52Low)} />
          <Stat label="RSI 14" value={num(stock.rsi, 1)} />
          <Stat label="Volatilitas" value={pct(stock.volatility, 1, false)} />
          <Stat label="MA20" value={idr(stock.ma20)} />
          <Stat label="MA50" value={idr(stock.ma50)} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Breakdown faktor</h2>
          <FactorList factors={stock.factors} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Kinerja relatif</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="1 bulan" value={<Change value={stock.ret1m} />} />
            <Stat label="Alpha 1 bulan" value={<Change value={stock.alpha1m} />} />
            <Stat label="3 bulan" value={<Change value={stock.ret3m} />} />
            <Stat label="Alpha 3 bulan" value={<Change value={stock.alpha3m} />} />
            <Stat label="YTD" value={<Change value={stock.retYtd} />} />
            <Stat label="Market cap" value={stock.marketCap ? compactShares(stock.marketCap) : "n/a"} />
          </div>
          <div className="mt-6">
            <Disclaimer compact />
          </div>
        </Card>
      </div>
    </div>
  );
}
