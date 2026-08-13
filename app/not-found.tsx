import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-gold">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <Link href="/" className="mt-4 inline-block text-mint">
        Kembali ke beranda
      </Link>
    </div>
  );
}
