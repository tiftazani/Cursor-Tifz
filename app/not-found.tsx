import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-28 text-center">
      <p className="text-[11px] uppercase tracking-[0.36em] text-gold">404</p>
      <h1 className="font-display mt-4 text-4xl italic">Halaman tidak ditemukan</h1>
      <Link href="/" className="mt-6 inline-block text-sm text-gold">
        Kembali ke desk →
      </Link>
    </div>
  );
}
