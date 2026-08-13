import { getDailySnapshot } from "@/lib/snapshot";
import { num, pct } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import { Card, Change, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "Data Investor" };

export default async function InvestorPage() {
  const snap = await getDailySnapshot();
  const p = snap.investor;
  return (
    <div>
      <PageHeader
        kicker="Aliran & breadth"
        title="Data investor harian"
        subtitle="Proksi internal dari universe likuid Cuan dan estimasi flow reksadana."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <Stat label="Naik" value={p.advancing} tone="up" />
        </Card>
        <Card>
          <Stat label="Turun" value={p.declining} tone="down" />
        </Card>
        <Card>
          <Stat label="Breadth" value={pct(p.breadthPct)} tone={p.breadthPct >= 0 ? "up" : "down"} />
        </Card>
        <Card>
          <Stat label="Volume vs avg" value={pct(p.volumeVsAvg - 1)} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Narasi hari ini</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-mute">
            {p.narrative.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-mute">{p.styleBias}</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Large cap vs others</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Large cap (rata-rata)" value={<Change value={p.largeCapRet} />} />
            <Stat label="Mid/small (rata-rata)" value={<Change value={p.smallCapRet} />} />
          </div>
          <p className="mt-4 text-sm text-mute">
            Jika large cap unggul, pasar cenderung defensive/blue chip. Jika mid-small unggul, selera risiko
            sedang naik.
          </p>
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Estimasi aliran reksadana</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {p.fundFlowByCategory.map((row) => (
          <Card key={row.category}>
            <p className="text-xs uppercase tracking-wider text-gold">{CATEGORY_LABEL[row.category]}</p>
            <p className="num mt-3 text-2xl">{num(row.flowMiliar, 1)} M</p>
            <p className="text-sm text-mute">
              Return NAB rata-rata <Change value={row.ret1d} />
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-6 max-w-3xl text-xs leading-5 text-mute">{p.methodology}</p>
    </div>
  );
}
