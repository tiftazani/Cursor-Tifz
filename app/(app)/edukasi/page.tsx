import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Edukasi" };

export default function EdukasiPage() {
  return (
    <div>
      <PageHeader
        kicker="Transparansi"
        title="Cara kerja desk"
        subtitle="Skor kuantitatif, robot analisa emiten, dan jejak pick vs IHSG — untuk riset, bukan nasihat resmi."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl italic">Skor saham</h2>
          <p className="mt-2 text-base leading-7 text-mute">
            Setiap emiten dibanding universe yang sama, lalu dibobot sesuai kondisi pasar: alpha 1 minggu sampai
            3 bulan vs IHSG, relatif sektor, P/E dan P/B, likuiditas, RSI, MA20/MA50, MACD, volatilitas, posisi
            52 minggu, dan konfirmasi volume. Skor 70+ = Beli, 50–69 = Tahan, di bawah 50 = Waspada.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-xl italic">Robot analisa</h2>
          <p className="mt-2 text-base leading-7 text-mute">
            Cuan Bot meminta kode atau nama emiten, lalu menjawab di bubble chat. Kalau saham ada di Bursa Efek,
            robot menggabungkan teknikal, IHSG, pasar global (S&amp;P, Nasdaq, Nikkei, USD/IDR), harga komoditas,
            dan berita. Kalau tidak ketemu: data emiten tidak ditemukan di list Bursa Efek.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-xl italic">Skor reksadana</h2>
          <p className="mt-2 text-base leading-7 text-mute">
            RDPU menekan volatilitas dan drawdown, menonjolkan imbal hasil stabil. RD saham menonjolkan Sharpe,
            alpha vs IHSG, konsistensi, dan aliran dana. RD obligasi menyeimbangkan imbal hasil, drawdown, AUM,
            dan biaya pengelolaan.
          </p>
        </Card>
        <Card>
          <h2 className="font-display text-xl italic">Sumber data</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-base text-mute">
            <li>Saham & IHSG: Yahoo Finance ticker .JK dan ^JKSE, termasuk grafik 5 menit.</li>
            <li>Global & komoditas: S&amp;P 500, Nasdaq, Nikkei, USD/IDR, minyak, emas, tembaga, gas, gandum, kopi.</li>
            <li>Berita: CNBC Indonesia dan Google News.</li>
            <li>Reksadana: katalog kurasi dengan model NAB yang dikaitkan ke IHSG/yield.</li>
          </ul>
        </Card>
        <Card className="md:col-span-2">
          <h2 className="font-display text-xl italic">Apa yang tidak kami lakukan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-base text-mute">
            <li>Tidak mengeksekusi order atau terhubung ke sekuritas.</li>
            <li>Tidak memakai data level-2 atau foreign flow resmi KSEI.</li>
            <li>Tidak menjamin pick hari ini mengalahkan IHSG esok hari — lihat Jejak.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
