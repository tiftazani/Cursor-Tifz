"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Change, LabelBadge, ScorePill } from "@/components/ui";
import { idr, pct } from "@/lib/format";
import type { RecLabel } from "@/lib/types";

type Row = {
  ticker: string;
  name: string;
  sector: string;
  score: number;
  label: RecLabel;
  price: number;
  changePct: number;
  ret1m: number;
  volumeRatio: number;
  pe: number | null;
  rsi: number;
};

export function ScreenerClient({ rows, sectors }: { rows: Row[]; sectors: string[] }) {
  const [sector, setSector] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [minMom, setMinMom] = useState(-1);
  const [minVol, setMinVol] = useState(0);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (sector === "all" || r.sector === sector) &&
          r.score >= minScore &&
          r.ret1m >= minMom &&
          r.volumeRatio >= minVol,
      ),
    [rows, sector, minScore, minMom, minVol],
  );

  return (
    <div>
      <Card className="grid gap-4 md:grid-cols-4">
        <label className="text-sm">
          <span className="text-mute">Sektor</span>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-background px-3 py-2"
          >
            <option value="all">Semua</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-mute">Skor min ({minScore})</span>
          <input
            type="range"
            min={0}
            max={90}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="mt-3 w-full"
          />
        </label>
        <label className="text-sm">
          <span className="text-mute">Momentum 1bln min ({pct(minMom === -1 ? 0 : minMom)})</span>
          <input
            type="range"
            min={-1}
            max={0.2}
            step={0.01}
            value={minMom}
            onChange={(e) => setMinMom(Number(e.target.value))}
            className="mt-3 w-full"
          />
        </label>
        <label className="text-sm">
          <span className="text-mute">Volume ratio min ({minVol.toFixed(1)}x)</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={minVol}
            onChange={(e) => setMinVol(Number(e.target.value))}
            className="mt-3 w-full"
          />
        </label>
      </Card>
      <p className="mt-4 text-sm text-mute">{filtered.length} emiten cocok</p>
      <div className="mt-3 overflow-x-auto card">
        <table className="min-w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-mute">
            <tr>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3">1 hari</th>
              <th className="px-4 py-3">1 bulan</th>
              <th className="px-4 py-3">RSI</th>
              <th className="px-4 py-3">Skor</th>
              <th className="px-4 py-3">Label</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.ticker} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/saham/${r.ticker}`} className="font-medium hover:text-mint">
                    {r.ticker}
                  </Link>
                  <p className="text-[11px] text-mute">{r.sector}</p>
                </td>
                <td className="px-4 py-3 num">{idr(r.price)}</td>
                <td className="px-4 py-3">
                  <Change value={r.changePct} />
                </td>
                <td className="px-4 py-3">
                  <Change value={r.ret1m} />
                </td>
                <td className="px-4 py-3 num">{r.rsi.toFixed(0)}</td>
                <td className="px-4 py-3">
                  <ScorePill score={r.score} />
                </td>
                <td className="px-4 py-3">
                  <LabelBadge label={r.label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
