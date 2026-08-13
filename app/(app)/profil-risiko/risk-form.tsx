"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/labels";
import { pct } from "@/lib/format";
import type { FundCategory } from "@/lib/types";

const QUESTIONS = [
  {
    id: "horizon",
    q: "Horizon investasi Anda?",
    options: [
      { t: "Kurang dari 1 tahun", s: 0 },
      { t: "1–3 tahun", s: 1 },
      { t: "3–5 tahun", s: 2 },
      { t: "Lebih dari 5 tahun", s: 3 },
    ],
  },
  {
    id: "dd",
    q: "Penurunan portofolio yang masih nyaman?",
    options: [
      { t: "Maksimal 5%", s: 0 },
      { t: "Sekitar 10%", s: 1 },
      { t: "Sekitar 20%", s: 2 },
      { t: "35% atau lebih, asal jangka panjang", s: 3 },
    ],
  },
  {
    id: "goal",
    q: "Tujuan utama dana ini?",
    options: [
      { t: "Dana darurat / likuiditas", s: 0 },
      { t: "Belanja 1–2 tahun ke depan", s: 1 },
      { t: "Pendidikan / DP rumah", s: 2 },
      { t: "Pertumbuhan kekayaan jangka panjang", s: 3 },
    ],
  },
  {
    id: "exp",
    q: "Pengalaman investasi?",
    options: [
      { t: "Baru mulai", s: 0 },
      { t: "Pernah beli reksadana", s: 1 },
      { t: "Aktif saham / RD campuran", s: 2 },
      { t: "Sangat familiar dengan risiko pasar", s: 3 },
    ],
  },
  {
    id: "react",
    q: "Jika portofolio turun 20% dalam sebulan, Anda akan…",
    options: [
      { t: "Jual semuanya", s: 0 },
      { t: "Jual sebagian", s: 1 },
      { t: "Tahan", s: 2 },
      { t: "Tambah beli", s: 3 },
    ],
  },
  {
    id: "cash",
    q: "Kebutuhan likuiditas vs dana mengendap?",
    options: [
      { t: "Bisa butuh kapan saja", s: 0 },
      { t: "Sebagian harus likuid", s: 1 },
      { t: "Mayoritas bisa mengendap", s: 2 },
      { t: "Tidak perlu disentuh bertahun-tahun", s: 3 },
    ],
  },
];

type FundLite = {
  id: string;
  name: string;
  category: FundCategory;
  score: number;
  ret1y: number;
  risk: string;
};

export function RiskForm({ funds }: { funds: FundLite[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  const complete = Object.keys(answers).length === QUESTIONS.length;
  const profile = total <= 6 ? "Konservatif" : total <= 12 ? "Moderat" : "Agresif";
  const alloc =
    profile === "Konservatif"
      ? { pasar_uang: 0.7, obligasi: 0.25, saham: 0.05 }
      : profile === "Moderat"
        ? { pasar_uang: 0.3, obligasi: 0.4, saham: 0.3 }
        : { pasar_uang: 0.1, obligasi: 0.2, saham: 0.7 };

  const picks = useMemo(() => {
    const pick = (c: FundCategory) =>
      funds.filter((f) => f.category === c).sort((a, b) => b.score - a.score)[0];
    return [pick("pasar_uang"), pick("obligasi"), pick("saham")].filter(Boolean) as FundLite[];
  }, [funds]);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {QUESTIONS.map((item) => (
          <Card key={item.id}>
            <p className="font-medium">{item.q}</p>
            <div className="mt-3 grid gap-2">
              {item.options.map((opt) => (
                <label key={opt.t} className="flex cursor-pointer items-center gap-2 text-sm text-mute">
                  <input
                    type="radio"
                    name={item.id}
                    checked={answers[item.id] === opt.s}
                    onChange={() => setAnswers({ ...answers, [item.id]: opt.s })}
                  />
                  {opt.t}
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card className="lg:col-span-2 h-fit lg:sticky lg:top-28">
        <p className="text-xs uppercase tracking-wider text-gold">Hasil</p>
        {complete ? (
          <>
            <p className="mt-2 text-2xl font-semibold">{profile}</p>
            <p className="text-sm text-mute">Skor {total} / 18</p>
            <div className="mt-5 space-y-2">
              {(Object.keys(alloc) as FundCategory[]).map((c) => (
                <div key={c}>
                  <div className="flex justify-between text-sm">
                    <span>{CATEGORY_LABEL[c]}</span>
                    <span className="num">{pct(alloc[c], 0, false)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/5">
                    <div className="h-2 rounded-full bg-mint" style={{ width: `${alloc[c] * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <h3 className="mt-6 text-sm font-semibold">Produk yang selaras (skor tertinggi)</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {picks.map((f) => (
                <li key={f.id}>
                  <Link href={`/reksadana/${f.id}`} className="text-mint hover:underline">
                    {f.name}
                  </Link>
                  <p className="text-xs text-mute">
                    {CATEGORY_LABEL[f.category]} · 1y {pct(f.ret1y)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-mute">Jawab semua pertanyaan untuk melihat alokasi.</p>
        )}
      </Card>
    </div>
  );
}
