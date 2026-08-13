import { getDailySnapshot } from "@/lib/snapshot";
import { num, pct } from "@/lib/format";
import { Card, Change, PageHeader, Stat } from "@/components/ui";
import { DualLineChart, DrawdownChart, RiskScatter, ScoreBarChart } from "@/components/charts";
import { StaleBanner } from "@/components/stale-banner";
import { clsx } from "@/lib/format";

export const metadata = { title: "Analitik" };

export default async function AnalitikPage() {
  const snap = await getDailySnapshot();
  const a = snap.analytics;
  const maxAbs = Math.max(...a.sectorHeatmap.map((s) => Math.abs(s.changePct)), 0.01);

  return (
    <div>
      <PageHeader
        kicker="Dashboard"
        title="Analitik desk"
        subtitle="IHSG vs portofolio equal-weight Top 5 (walk-forward), heatmap sektor, scatter risiko-imbal hasil, dan distribusi skor."
      />
      <StaleBanner stale={snap.stale} notes={snap.notes} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <Stat label="Hit rate 1 hari" value={pct(a.summary.hitRate, 0, false)} />
        </Card>
        <Card>
          <Stat
            label="Alpha 1 hari avg"
            value={<Change value={a.summary.avgAlpha1d} />}
            tone={a.summary.avgAlpha1d >= 0 ? "up" : "down"}
          />
        </Card>
        <Card>
          <Stat label="Alpha 5 hari avg" value={<Change value={a.summary.avgAlpha5d} />} />
        </Card>
        <Card>
          <Stat label="Top5 vs IHSG ~1 bln" value={<Change value={a.summary.picksVsIhsg30d} />} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Top 5 walk-forward vs IHSG</h2>
          <p className="mb-3 text-xs text-mute">Nav 100 di awal seri. Hijau = pick, emas = IHSG.</p>
          <DualLineChart data={a.picksSeries.slice(-120)} />
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Drawdown IHSG</h2>
          <DrawdownChart data={a.drawdown.slice(-180)} />
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Heatmap sektor (1 hari)</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {a.sectorHeatmap.map((s) => {
              const intensity = Math.abs(s.changePct) / maxAbs;
              const bg =
                s.changePct >= 0
                  ? `rgba(62, 224, 176, ${0.12 + intensity * 0.45})`
                  : `rgba(255, 107, 138, ${0.12 + intensity * 0.45})`;
              return (
                <div key={s.sector} className="rounded-xl border border-line p-3" style={{ background: bg }}>
                  <p className="text-sm font-medium">{s.sector}</p>
                  <p className="num text-lg">
                    <Change value={s.changePct} />
                  </p>
                  <p className="text-[11px] text-mute">
                    skor {num(s.avgScore, 0)} · {s.count} emiten
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Distribusi Cuan Score</h2>
          <ScoreBarChart data={a.scoreBuckets} />
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Scatter risiko vs imbal hasil 1 bulan</h2>
        <p className="mb-3 text-xs text-mute">X = volatilitas annualized (%), Y = return 1 bulan (%). Warna = skor.</p>
        <RiskScatter data={a.scatter} />
      </Card>

      <p className={clsx("mt-4 text-xs text-mute")}>As-of {snap.asOf} · sumber {snap.source}</p>
    </div>
  );
}
