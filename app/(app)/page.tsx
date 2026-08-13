import Link from "next/link";
import { getDailySnapshot } from "@/lib/snapshot";
import { compactShares, idr, num, pct } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import { marketStatusLabel } from "@/lib/time";
import { Card, Change, LabelBadge, PageHeader, ScorePill, Stat } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { StaleBanner } from "@/components/stale-banner";
import type { FundCategory } from "@/lib/types";

export default async function HomePage() {
  const snap = await getDailySnapshot();
  const cats: FundCategory[] = ["pasar_uang", "saham", "obligasi"];

  return (
    <div>
      <PageHeader
        kicker="Market pulse"
        title="Rekomendasi harian pasar Indonesia"
        subtitle={`IHSG dan ranking kuantitatif Cuan untuk ${snap.asOf}. Status: ${marketStatusLabel(snap.marketStatus)}.`}
      />
      <StaleBanner stale={snap.stale} notes={snap.notes} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-mute">IHSG</p>
              <p className="num mt-2 text-4xl font-semibold">{num(snap.ihsg.last, 2)}</p>
              <p className="mt-1 text-sm">
                <Change value={snap.ihsg.changePct} /> · 1 bln <Change value={snap.ihsg.ret1m} />
              </p>
            </div>
            <Sparkline data={snap.ihsg.spark} color={snap.ihsg.changePct >= 0 ? "#3ee0b0" : "#ff6b8a"} />
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Open" value={num(snap.ihsg.open, 2)} />
            <Stat label="High" value={num(snap.ihsg.high, 2)} />
            <Stat label="Low" value={num(snap.ihsg.low, 2)} />
          </div>
        </Card>
        <Card>
          <Stat
            label="Breadth universe"
            value={`${snap.investor.advancing} / ${snap.investor.declining}`}
            hint="Naik vs turun"
            tone={snap.investor.breadthPct >= 0 ? "up" : "down"}
          />
          <p className="mt-4 text-xs text-mute">Volume vs avg 20h: {pct(snap.investor.volumeVsAvg - 1)}</p>
        </Card>
        <Card>
          <Stat
            label="Hit rate jejak 1 hari"
            value={pct(snap.analytics.summary.hitRate, 0, false)}
            hint={`Alpha 1h rata-rata ${pct(snap.analytics.summary.avgAlpha1d)}`}
          />
        </Card>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Top pick saham</h2>
          <Link href="/saham" className="text-sm text-mint">
            Semua ranking →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {snap.stockPicks.slice(0, 3).map((s) => (
            <Link key={s.ticker} href={`/saham/${s.ticker}`}>
              <Card hover>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold">{s.ticker}</p>
                    <p className="text-xs text-mute">{s.name}</p>
                  </div>
                  <LabelBadge label={s.label} />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="num text-xl">{idr(s.price)}</p>
                    <Change value={s.changePct} />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-mute">Cuan Score</p>
                    <ScorePill score={s.score} />
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-mute">{s.insight}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Pick reksadana per kategori</h2>
          <Link href="/reksadana" className="text-sm text-mint">
            Bandingkan produk →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cats.map((c) => {
            const f = snap.fundPicks[c];
            return (
              <Link key={c} href={`/reksadana/${f.id}`}>
                <Card hover>
                  <p className="text-xs uppercase tracking-wider text-gold">{CATEGORY_LABEL[c]}</p>
                  <p className="mt-2 font-semibold">{f.name}</p>
                  <p className="text-xs text-mute">{f.mi}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="num text-lg">{num(f.nab, 2)}</p>
                      <Change value={f.nabChangePct} />
                    </div>
                    <ScorePill score={f.score} />
                  </div>
                  <p className="mt-3 text-xs text-mute">1 tahun {pct(f.ret1y)} · AUM {num(f.aumMiliar, 0)} M</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold">Sinyal investor hari ini</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-mute">
            {snap.investor.narrative.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
          <Link href="/investor" className="mt-4 inline-block text-sm text-mint">
            Buka data investor →
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Aktivitas universe</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="YTD IHSG" value={<Change value={snap.ihsg.retYtd} />} />
            <Stat label="3 bulan IHSG" value={<Change value={snap.ihsg.ret3m} />} />
            <Stat
              label="Vol teratas"
              value={snap.stocks.slice().sort((a, b) => b.volume - a.volume)[0]?.ticker ?? "—"}
              hint={compactShares(snap.stocks.slice().sort((a, b) => b.volume - a.volume)[0]?.volume ?? 0)}
            />
            <Stat label="Sumber" value={snap.source} hint={snap.asOfWib} />
          </div>
        </Card>
      </section>
    </div>
  );
}
