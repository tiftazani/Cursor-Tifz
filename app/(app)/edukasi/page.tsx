import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Edukasi" };

export default function EdukasiPage() {
  return (
    <div>
      <PageHeader
        kicker="Transparansi"
        title="Cara kerja desk"
        subtitle="Mesin ini kuantitatif dan bisa diaudit. Bukan kecerdasan buatan hitam, dan bukan izin usaha OJK."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl italic">Skor saham</h2>
          <p className="mt-2 text-sm leading-6 text-mute">
            Setiap emiten di-z-score terhadap universe yang sama, lalu dibobot: alpha 1 & 3 bulan vs IHSG,
            P/E dan P/B (jika ada), rasio volume, RSI, sinyal MA20/MA50, penalti volatilitas, dan posisi vs
            52 minggu. Skor 70+ = Beli, 50–69 = Tahan, di bawah 50 = Waspada.
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Skor reksadana</h2>
          <p className="mt-2 text-sm leading-6 text-mute">
            RDPU menekan volatilitas dan drawdown, menonjolkan yield stabil. RD saham menonjolkan Sharpe dan
            alpha vs IHSG. RD obligasi menyeimbangkan imbal hasil, drawdown, AUM, dan expense ratio.
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Sumber data</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-mute">
            <li>Saham & IHSG: Yahoo Finance ticker .JK dan ^JKSE.</li>
            <li>Reksadana: katalog kurasi + model NAB yang dikaitkan ke IHSG/yield, bukan feed OJK.</li>
            <li>Investor: breadth/volume universe + estimasi flow ΔAUM − return.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-xl italic">Apa yang tidak kami lakukan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-mute">
            <li>Tidak mengeksekusi order atau terhubung ke sekuritas.</li>
            <li>Tidak memakai data level-2 atau foreign flow resmi KSEI.</li>
            <li>Tidak menjamin pick hari ini mengalahkan IHSG esok hari — lihat Jejak.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
