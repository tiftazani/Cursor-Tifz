import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://cuan-tif.vercel.app"),
  title: "IMO FACTORY — Analitik grup WhatsApp",
  description:
    "Dashboard publik analitik grup WhatsApp IMO Pelindo/IPC: anggota paling aktif, topik, pola waktu, dan highlight 2021–2026. Tanpa isi chat mentah.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "IMO FACTORY — Analitik grup WhatsApp",
    description:
      "29 ribu pesan, 24 anggota, 5 tahun obrolan. Ranking keaktifan, topik, dan pola jam kerja grup IMO.",
    url: "/imo",
    siteName: "IMO FACTORY",
    locale: "id_ID",
    type: "website",
  },
};

export default function ImoLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-col">{children}</div>;
}
