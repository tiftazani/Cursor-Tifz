export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-[11px] leading-5 text-mute">
        Bukan penawaran efek dan bukan nasihat investasi berizin OJK. Kinerja masa lalu tidak menjamin hasil
        masa depan. Cuan Score adalah model kuantitatif internal.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-white/2 px-4 py-3 text-xs leading-5 text-mute">
      Informasi di Cuan bersifat edukasi dan riset. Ini <strong className="text-foreground/80">bukan</strong>{" "}
      penawaran efek, bukan rekomendasi transaksi, dan bukan nasihat investasi dari pihak yang berizin OJK.
      Data Yahoo Finance / model NAB reksadana dapat tertunda atau tidak lengkap. Keputusan investasi
      sepenuhnya tanggung jawab Anda.
    </div>
  );
}
