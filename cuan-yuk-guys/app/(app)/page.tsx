import Link from "next/link";
import { getDailySnapshot } from "@/lib/snapshot";
import { getMarketNews } from "@/lib/news";
import { compactShares, idr, num, pct } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import { formatWibClock, marketStatusLabel } from "@/lib/time";
import { Card, Change, LabelBadge, LiveBadge, PageHeader, ScorePill, Stat } from "@/components/ui";
import { IhsgChart } from "@/components/charts";
import { NewsList } from "@/components/news-list";
import { AnalystChat } from "@/components/analyst-chat";
import type { FundCategory } from "@/lib/types";

export default async function HomePage() {
  const [snap, news] = await Promise.all([getDailySnapshot(), getMarketNews()]);
  const cats: FundCategory[] = ["pasar_uang", "saham", "obligasi"];
  const ihsgColor = snap.ihsg.changePct >= 0 ? "#9cba8a" : "#d46a6a";
  const chartLabel = snap.ihsg.chartKind === "intraday" ? "Hari ini · 5 menit" : "60 hari terakhir";

  return (
    <div>
      <PageHeader
        kicker="Desk hari ini"
        title="Cuan Yuk Guys"
        subtitle={`${snap.asOfWib}. ${marketStatusLabel(snap.marketStatus)}. Pilihan saham IHSG dan reksadana.`}
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gold">IHSG</p>
              <p className="num mt-2 text-5xl font-semibold">{num(snap.ihsg.last, 2)}</p>
              <p className="mt-2 text-base">
                <Change value={snap.ihsg.changePct} /> · 1 bln <Change value={snap.ihsg.ret1m} />
              </p>
            </div>
            <div className="text-right">
              <LiveBadge
                marketStatus={snap.marketStatus}
                stale={snap.stale}
                clock={formatWibClock(snap.generatedAt)}
              />
              <p className="mt-2 text-sm text-mute">{chartLabel}</p>
            </div>
          </div>
          <IhsgChart data={snap.ihsg.chart} color={ihsgColor} />
          <div className="mt-6 grid grid-cols-3 gap-3 text-base">
            <Stat label="Open" value={num(snap.ihsg.open, 2)} />
            <Stat label="High" value={num(snap.ihsg.high, 2)} />
            <Stat label="Low" value={num(snap.ihsg.low, 2)} />
          </div>
        </Card>
        <Card className="lg:col-span-5 max-h-[36rem] overflow-hidden">
          <NewsList items={news} />
        </Card>
      </div>

      <section className="mt-8">
        <AnalystChat />
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card>
          <Stat
            label="Saham naik / turun"
            value={`${snap.investor.advancing} / ${snap.investor.declining}`}
            hint="Universe likuid hari ini"
            tone={snap.investor.breadthPct >= 0 ? "up" : "down"}
          />
          <p className="mt-4 text-sm text-mute">Volume vs rata-rata 20 hari: {pct(snap.investor.volumeVsAvg - 1)}</p>
        </Card>
        <Card>
          <Stat
            label="Akurasi pick vs IHSG"
            value={pct(snap.analytics.summary.hitRate, 0, false)}
            hint={`Selisih 1 hari rata-rata ${pct(snap.analytics.summary.avgAlpha1d)}`}
          />
        </Card>
        <Card>
          <Stat label="IHSG tahun ini" value={<Change value={snap.ihsg.retYtd} />} hint={snap.asOfWib} />
        </Card>
      </div>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-3xl italic">Top pick saham</h2>
          <Link href="/saham" className="text-base text-gold">
            Semua ranking →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {snap.stockPicks.slice(0, 3).map((s) => (
            <Link key={s.ticker} href={`/saham/${s.ticker}`}>
              <Card hover>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-semibold">{s.ticker}</p>
                    <p className="text-sm text-mute">{s.name}</p>
                  </div>
                  <LabelBadge label={s.label} />
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="num text-2xl">{idr(s.price)}</p>
                    <Change value={s.changePct} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-mute">Cuan Score</p>
                    <ScorePill score={s.score} />
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-mute">{s.insight}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-3xl italic">Pick reksadana</h2>
          <Link href="/reksadana" className="text-base text-gold">
            Bandingkan produk →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {cats.map((c) => {
            const f = snap.fundPicks[c];
            return (
              <Link key={c} href={`/reksadana/${f.id}`}>
                <Card hover>
                  <p className="text-xs uppercase tracking-wider text-gold">{CATEGORY_LABEL[c]}</p>
                  <p className="mt-2 text-lg font-semibold">{f.name}</p>
                  <p className="text-sm text-mute">{f.mi}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="num text-xl">{num(f.nab, 2)}</p>
                      <Change value={f.nabChangePct} />
                    </div>
                    <ScorePill score={f.score} />
                  </div>
                  <p className="mt-3 text-sm text-mute">
                    1 tahun {pct(f.ret1y)} · AUM {num(f.aumMiliar, 0)} M
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-3xl italic">Sinyal investor</h2>
          <ul className="mt-4 space-y-2 text-base leading-7 text-mute">
            {snap.investor.narrative.map((n) => (
              <li key={n}>• {n}</li>
            ))}
          </ul>
          <Link href="/investor" className="mt-5 inline-block text-base text-gold">
            Buka data investor →
          </Link>
        </Card>
        <Card>
          <h2 className="font-display text-3xl italic">Aktivitas universe</h2>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <Stat label="YTD IHSG" value={<Change value={snap.ihsg.retYtd} />} />
            <Stat label="3 bulan IHSG" value={<Change value={snap.ihsg.ret3m} />} />
            <Stat
              label="Volume teratas"
              value={snap.stocks.slice().sort((a, b) => b.volume - a.volume)[0]?.ticker ?? "—"}
              hint={compactShares(snap.stocks.slice().sort((a, b) => b.volume - a.volume)[0]?.volume ?? 0)}
            />
            <Stat label="Diperbarui" value={formatWibClock(snap.generatedAt)} hint={snap.asOfWib} />
          </div>
        </Card>
      </section>
    </div>
  );
}
