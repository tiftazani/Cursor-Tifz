"use client";

import Link from "next/link";
import { Card, Change, LabelBadge, ScorePill } from "@/components/ui";
import { useWatchlist } from "@/components/watchlist";
import { idr } from "@/lib/format";
import type { RecLabel } from "@/lib/types";

type Row = {
  ticker: string;
  name: string;
  sector: string;
  score: number;
  label: RecLabel;
  price: number;
  changePct: number;
  insight: string;
};

export function WatchlistClient({ rows }: { rows: Row[] }) {
  const { tickers, toggle } = useWatchlist();
  const selected = rows.filter((r) => tickers.includes(r.ticker));

  if (!tickers.length) {
    return (
      <Card>
        <p className="text-sm text-mute">
          Watchlist masih kosong. Buka halaman{" "}
          <Link href="/saham" className="text-gold">
            Saham
          </Link>{" "}
          lalu tambahkan emiten.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {selected.map((s) => (
        <Card key={s.ticker}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={`/saham/${s.ticker}`} className="text-lg font-semibold hover:text-gold">
                {s.ticker}
              </Link>
              <p className="text-xs text-mute">{s.name}</p>
            </div>
            <LabelBadge label={s.label} />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="num text-xl">{idr(s.price)}</p>
              <Change value={s.changePct} />
            </div>
            <ScorePill score={s.score} />
          </div>
          <p className="mt-3 text-xs leading-5 text-mute">{s.insight}</p>
          <button type="button" onClick={() => toggle(s.ticker)} className="mt-3 text-xs text-rose">
            Hapus
          </button>
        </Card>
      ))}
    </div>
  );
}
