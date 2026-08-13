import Link from "next/link";
import { getDailySnapshot } from "@/lib/snapshot";
import { compactShares, idr, num } from "@/lib/format";
import { Change, LabelBadge, PageHeader, ScorePill } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { WatchButton } from "@/components/watchlist";

export const metadata = { title: "Saham IHSG" };

export default async function SahamPage() {
  const snap = await getDailySnapshot();
  return (
    <div>
      <PageHeader
        kicker="Mesin saham"
        title="Ranking skor IHSG"
        subtitle="Universe 42 emiten likuid (IDX30/LQ45 + blue chip). Skor 0–100 dari momentum, alpha vs IHSG, likuiditas, teknikal, dan valuasi."
      />
      <div className="overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Emiten</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">1 hari</th>
              <th className="px-4 py-3">Alpha 1bln</th>
              <th className="px-4 py-3">Vol</th>
              <th className="px-4 py-3">Skor</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {snap.stocks.map((s, i) => (
              <tr key={s.ticker} className="border-t border-line">
                <td className="px-4 py-3 num text-mute">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/saham/${s.ticker}`} className="font-medium hover:text-gold">
                    {s.ticker}
                  </Link>
                  <p className="text-[11px] text-mute">{s.sector}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="num">{idr(s.price)}</span>
                    <Sparkline data={s.spark} color={s.changePct >= 0 ? "#9cba8a" : "#d46a6a"} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Change value={s.changePct} />
                </td>
                <td className="px-4 py-3">
                  <Change value={s.alpha1m} />
                </td>
                <td className="px-4 py-3 num text-mute">{compactShares(s.volume)}</td>
                <td className="px-4 py-3">
                  <ScorePill score={s.score} />
                </td>
                <td className="px-4 py-3">
                  <LabelBadge label={s.label} />
                </td>
                <td className="px-4 py-3">
                  <WatchButton ticker={s.ticker} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-mute">
        P/E rata-rata terisi: {num(snap.stocks.filter((s) => s.pe).length, 0)}/{snap.stocks.length} emiten.
      </p>
    </div>
  );
}
