import Link from "next/link";
import { getDailySnapshot } from "@/lib/snapshot";
import { num } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import { Card, Change, LabelBadge, PageHeader, ScorePill } from "@/components/ui";
import { StaleBanner } from "@/components/stale-banner";
import type { FundCategory } from "@/lib/types";
import { clsx } from "@/lib/format";

export const metadata = { title: "Reksadana" };

export default async function ReksadanaPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const { kategori } = await searchParams;
  const snap = await getDailySnapshot();
  const cats: FundCategory[] = ["pasar_uang", "saham", "obligasi"];
  const active: FundCategory = cats.includes(kategori as FundCategory)
    ? (kategori as FundCategory)
    : "pasar_uang";
  const list = snap.funds.filter((f) => f.category === active).sort((a, b) => b.score - a.score);

  return (
    <div>
      <PageHeader
        kicker="Reksadana harian"
        title="Pasar uang, saham, dan obligasi"
        subtitle="Katalog 24 produk kurasi. NAB harian dikaitkan ke IHSG (RD saham) dan proksi yield (RDPU/obligasi). Bukan NAB OJK resmi — setiap kartu menampilkan catatan sumber."
      />
      <StaleBanner stale={snap.stale} notes={snap.notes} />
      <div className="mb-6 flex flex-wrap gap-2">
        {cats.map((c) => (
          <Link
            key={c}
            href={`/reksadana?kategori=${c}`}
            className={clsx(
              "border px-4 py-1.5 text-[11px] uppercase tracking-[0.16em]",
              active === c ? "border-gold bg-gold/10 text-gold" : "border-line text-mute hover:text-foreground",
            )}
          >
            {CATEGORY_LABEL[c]}
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((f) => (
          <Link key={f.id} href={`/reksadana/${f.id}`}>
            <Card hover>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-xs text-mute">{f.mi}</p>
                </div>
                <LabelBadge label={f.label} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-mute">NAB</p>
                  <p className="num">{num(f.nab, 2)}</p>
                  <Change value={f.nabChangePct} />
                </div>
                <div>
                  <p className="text-[11px] text-mute">1 tahun</p>
                  <Change value={f.ret1y} />
                  <p className="text-[11px] text-mute">Sharpe {num(f.sharpe, 2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-mute">Cuan Score</p>
                  <ScorePill score={f.score} />
                  <p className="text-[11px] text-mute">AUM {num(f.aumMiliar, 0)} M</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-mute">{f.sourceNote}</p>
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-mute">
        Estimasi aliran dana per kategori ada di halaman Investor. Return 1 tahun di kartu memakai seri NAB
        model, bukan janji kinerja.
      </p>
    </div>
  );
}
