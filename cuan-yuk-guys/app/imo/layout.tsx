import type { Metadata, Viewport } from "next";
import "./imo.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cuan-tif.vercel.app"),
  title: "IMO Factory — Analitik grup WhatsApp",
  description:
    "Dashboard publik analitik grup WhatsApp IMO Pelindo/IPC: anggota paling aktif, topik, pola waktu, dan highlight 2021–2026. Tanpa isi chat mentah.",
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    title: "IMO Factory",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "IMO Factory — Analitik grup WhatsApp",
    description:
      "29 ribu pesan, 24 anggota, 5 tahun obrolan. Ranking keaktifan, topik, dan pola jam kerja grup IMO.",
    url: "/imo",
    siteName: "IMO Factory",
    locale: "id_ID",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function ImoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
