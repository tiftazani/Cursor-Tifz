import Link from "next/link";
import { getDailySnapshot } from "@/lib/snapshot";
import { pct } from "@/lib/format";
import { Card, Change, PageHeader, Stat } from "@/components/ui";
import { StaleBanner } from "@/components/stale-banner";

export const metadata = { title: "Jejak Rekomendasi" };

export default async function JejakPage() {
  const snap = await getDailySnapshot();
  const track = [...snap.analytics.trackRecord].reverse();

  return (
    <div>
      <PageHeader
        kicker="Akuntabilitas"
        title="Jejak rekomendasi"
        subtitle="Walk-forward: setiap hari mesin merangking Top 5 dari data hingga hari itu, lalu diukur vs IHSG di sesi berikutnya. Bukan janji imbal hasil."
      />
      <StaleBanner stale={snap.stale} notes={snap.notes} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <Stat label="Hit rate" value={pct(snap.analytics.summary.hitRate, 0, false)} />
        </Card>
        <Card>
          <Stat label="Alpha 1 hari avg" value={<Change value={snap.analytics.summary.avgAlpha1d} />} />
        </Card>
        <Card>
          <Stat label="Alpha 5 hari avg" value={<Change value={snap.analytics.summary.avgAlpha5d} />} />
        </Card>
      </div>
      <p className="mt-6 text-sm text-mute">
        Refresh model: pre-open dan sekitar 16:30 WIB. Pick hari ini:{" "}
        {snap.stockPicks.map((s) => s.ticker).join(", ")}.
      </p>
      <div className="mt-4 overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Top 5</th>
              <th className="px-4 py-3">Pick 1h</th>
              <th className="px-4 py-3">IHSG 1h</th>
              <th className="px-4 py-3">Alpha</th>
              <th className="px-4 py-3">5 hari</th>
            </tr>
          </thead>
          <tbody>
            {track.map((t) => (
              <tr key={t.date} className="border-t border-line">
                <td className="px-4 py-3 num">{t.date}</td>
                <td className="px-4 py-3">
                  {t.tickers.map((tk) => (
                    <Link key={tk} href={`/saham/${tk}`} className="mr-2 text-gold">
                      {tk}
                    </Link>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <Change value={t.pickRet1d} />
                </td>
                <td className="px-4 py-3">
                  <Change value={t.ihsgRet1d} />
                </td>
                <td className="px-4 py-3">
                  <Change value={t.alpha1d} />
                </td>
                <td className="px-4 py-3">{t.alpha5d == null ? "—" : <Change value={t.alpha5d} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
