export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[11px] leading-5 text-mute">
        Bukan penawaran efek dan bukan nasihat investasi berizin OJK. Kinerja masa lalu tidak menjamin hasil
        masa depan. Skor Cuan adalah model kuantitatif internal Cuan Yuk Guys.
      </p>
    );
  }
  return (
    <div className="border border-line bg-black/30 px-4 py-3 text-xs leading-6 text-mute">
      Informasi di <span className="text-foreground/90">Cuan Yuk Guys</span> bersifat edukasi dan riset. Ini{" "}
      <strong className="text-foreground">bukan</strong> penawaran efek, bukan rekomendasi transaksi, dan
      bukan nasihat dari pihak berizin OJK. Data dapat tertunda. Keputusan investasi sepenuhnya tanggung jawab
      Anda.
    </div>
  );
}
