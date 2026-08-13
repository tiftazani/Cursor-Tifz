import { getDailySnapshot } from "@/lib/snapshot";
import { PageHeader } from "@/components/ui";
import { RiskForm } from "./risk-form";

export const metadata = { title: "Profil Risiko" };

export default async function RiskPage() {
  const snap = await getDailySnapshot();
  const funds = snap.funds.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    score: f.score,
    ret1y: f.ret1y,
    risk: f.risk,
  }));
  return (
    <div>
      <PageHeader
        kicker="Kuesioner"
        title="Profil risiko"
        subtitle="Enam pertanyaan untuk memetakan alokasi RDPU / obligasi / saham. Hasil tersimpan di perangkat Anda, bukan di server."
      />
      <RiskForm funds={funds} />
    </div>
  );
}
