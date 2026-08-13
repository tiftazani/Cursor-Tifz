import { notFound } from "next/navigation";
import { getDailySnapshot } from "@/lib/snapshot";
import { num, pct } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import { Card, Change, LabelBadge, PageHeader, ScorePill, Stat } from "@/components/ui";
import { PriceChart } from "@/components/charts";
import { FactorList } from "@/components/factor-list";
import { Disclaimer } from "@/components/disclaimer";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: id };
}

export default async function FundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snap = await getDailySnapshot();
  const fund = snap.funds.find((f) => f.id === id);
  if (!fund) notFound();

  return (
    <div>
      <PageHeader kicker={CATEGORY_LABEL[fund.category]} title={fund.name} subtitle={fund.insight} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <LabelBadge label={fund.label} />
        <span className="text-sm text-mute">
          Cuan Score <ScorePill score={fund.score} />
        </span>
        <span className="text-xs text-mute">{fund.mi}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs text-mute">NAB/Up</p>
              <p className="num text-3xl font-semibold">{num(fund.nab, 4)}</p>
              <Change value={fund.nabChangePct} />
            </div>
          </div>
          <PriceChart data={fund.series.map((s) => ({ date: s.date, value: s.nab }))} color="#e4c36a" />
        </Card>
        <Card className="grid grid-cols-2 gap-4">
          <Stat label="1 bulan" value={<Change value={fund.ret1m} />} />
          <Stat label="3 bulan" value={<Change value={fund.ret3m} />} />
          <Stat label="1 tahun" value={<Change value={fund.ret1y} />} />
          <Stat label="YTD" value={<Change value={fund.retYtd} />} />
          <Stat label="Sharpe" value={num(fund.sharpe, 2)} />
          <Stat label="Max DD" value={pct(fund.maxDrawdown)} />
          <Stat label="AUM" value={`${num(fund.aumMiliar, 0)} M`} />
          <Stat label="Expense" value={`${num(fund.expenseRatio, 2)}%`} />
        </Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Faktor skor</h2>
          <FactorList factors={fund.factors} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Estimasi aliran dana</h2>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="1 hari" value={`${num(fund.flow1d, 1)} M`} tone={fund.flow1d >= 0 ? "up" : "down"} />
            <Stat label="5 hari" value={`${num(fund.flow5d, 1)} M`} tone={fund.flow5d >= 0 ? "up" : "down"} />
            <Stat label="21 hari" value={`${num(fund.flow21d, 1)} M`} tone={fund.flow21d >= 0 ? "up" : "down"} />
          </div>
          <p className="mt-4 text-xs text-mute">
            Bank kustodian: {fund.custody}. Risiko produk: {fund.risk}. Alpha vs IHSG 1 tahun: {pct(fund.alpha1y)}.
          </p>
          <div className="mt-6">
            <Disclaimer compact />
          </div>
        </Card>
      </div>
    </div>
  );
}
