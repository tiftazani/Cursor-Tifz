"use client";

import { useMemo, useState } from "react";
import { Card, Stat } from "@/components/ui";
import { HourBar, MonthlyArea, WeekdayBar, YearBar } from "@/components/imo-charts";
import { dateLabel, humans, idNum, imo, type ImoMember } from "@/lib/imo";
import { clsx } from "@/lib/format";

const TOC = [
  { href: "#ringkasan", label: "Ringkasan" },
  { href: "#anggota", label: "Anggota" },
  { href: "#topik", label: "Topik" },
  { href: "#waktu", label: "Waktu" },
  { href: "#budaya", label: "Budaya" },
];

const ROLE_LABEL: Record<string, string> = {
  mostActive: "Paling aktif",
  mostPresent: "Paling sering hadir",
  stickerKing: "Raja stiker",
  imageKing: "Raja gambar",
  mentionMagnet: "Paling di-tag",
  threadStarter: "Pembuka thread",
  nightOwl: "Night owl",
  longWriter: "Teks terpanjang",
  emojiKing: "Raja emoji",
};

function badges(member: ImoMember, roles: Record<string, string | null>): string[] {
  const out: string[] = [];
  for (const [key, label] of Object.entries(ROLE_LABEL)) {
    if (roles[key] === member.name) out.push(label);
  }
  if (member.alumni) out.push("Alumni");
  return out;
}

function Heatmap({
  cells,
}: {
  cells: { dow: number; day: string; hour: number; count: number }[];
}) {
  const max = Math.max(...cells.map((c) => c.count), 1);
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        <div className="mb-1 grid grid-cols-[2.4rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[10px] text-mute">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
            </span>
          ))}
        </div>
        {days.map((day, dow) => (
          <div key={day} className="mb-0.5 grid grid-cols-[2.4rem_repeat(24,minmax(0,1fr))] gap-0.5">
            <span className="self-center text-[11px] text-mute">{day}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = cells.find((c) => c.dow === dow && c.hour === hour);
              const n = cell?.count ?? 0;
              const t = n / max;
              return (
                <div
                  key={hour}
                  title={`${day} ${String(hour).padStart(2, "0")}.00 · ${idNum(n)} pesan`}
                  className="h-5 rounded-[1px]"
                  style={{
                    background:
                      n === 0
                        ? "rgba(255,255,255,0.035)"
                        : `rgba(201, 162, 79, ${0.12 + t * 0.78})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-mute">Gelap = sepi · emas = ramai. Skala per sel, bukan per orang.</p>
    </div>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-sm border border-line px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-gold hover:border-gold"
      onClick={async () => {
        const url = window.location.href;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* ignore */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? "Tersalin" : "Salin tautan"}
    </button>
  );
}

export function ImoDashboard() {
  const people = useMemo(() => humans(), []);
  const maxMsg = people[0]?.messages ?? 1;
  const maxTopic = imo.topics[0]?.messages ?? 1;
  const bot = imo.members.find((m) => m.bot);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.34em] text-gold">Dashboard publik</p>
            <p className="font-display text-[1.35rem] font-medium italic leading-none tracking-tight">
              IMO <span className="text-gold not-italic">FACTORY</span>
            </p>
          </div>
          <nav className="hidden gap-4 md:flex">
            {TOC.map((t) => (
              <a
                key={t.href}
                href={t.href}
                className="text-[12px] uppercase tracking-[0.16em] text-mute hover:text-gold"
              >
                {t.label}
              </a>
            ))}
          </nav>
          <CopyLink />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <header className="mb-10" id="ringkasan">
          <p className="text-xs uppercase tracking-[0.32em] text-gold">WhatsApp group analytics</p>
          <h1 className="font-display mt-3 text-5xl font-medium italic leading-[1.05] tracking-tight md:text-6xl">
            Siapa yang paling ramai di IMO
          </h1>
          <div className="hairline my-5 max-w-xs" />
          <p className="max-w-2xl text-base leading-8 text-mute">
            Agregat {idNum(imo.totals.messages)} pesan dari {dateLabel(imo.meta.firstMessageAt)} sampai{" "}
            {dateLabel(imo.meta.lastMessageAt)}. Ranking anggota, topik, dan pola waktu — tanpa isi chat,
            tanpa nomor telepon, tanpa sandi rapat.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <Stat label="Pesan" value={idNum(imo.totals.messages)} hint={`${idNum(imo.totals.avgPerDay)} / hari kalender`} />
          </Card>
          <Card>
            <Stat label="Anggota yang pernah chat" value={idNum(imo.totals.members)} hint={`${idNum(imo.totals.activeDays)} hari ada obrolan`} />
          </Card>
          <Card>
            <Stat label="Usia grup" value={`${idNum(imo.meta.spanDays)} hari`} hint={`${dateLabel(imo.meta.firstMessageAt)} – ${dateLabel(imo.meta.lastMessageAt)}`} />
          </Card>
          <Card>
            <Stat
              label="Top 5 menulis"
              value={`${imo.totals.top5SharePct.toString().replace(".", ",")}%`}
              hint="Hermawan, Danti, Lucky, Tifta, Fajar"
            />
          </Card>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <Stat label="Jam kantor 09–18" value={`${idNum(imo.totals.officePct, 0)}%`} hint="Grup ini hidup di hari kerja" />
          </Card>
          <Card>
            <Stat label="Akhir pekan" value={`${imo.totals.weekendPct.toString().replace(".", ",")}%`} />
          </Card>
          <Card>
            <Stat
              label="Stiker / gambar"
              value={`${idNum(imo.totals.stickers)} / ${idNum(imo.totals.images)}`}
            />
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Highlight yang perlu dilihat</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {imo.highlights.map((h) => (
              <Card key={h.title} hover>
                <p className="text-[11px] uppercase tracking-[0.18em] text-gold">{h.kicker}</p>
                <h3 className="mt-2 text-xl font-medium leading-snug">{h.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mute">{h.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-12" id="anggota">
          <h2 className="text-lg font-semibold">Peringkat anggota paling aktif</h2>
          <p className="mb-5 mt-1 max-w-2xl text-sm leading-6 text-mute">
            Diurutkan dari jumlah pesan (teks + media). Danti memimpin hari kehadiran, Lucky memimpin stiker,
            Tifta memimpin gambar. Meta AI (bot WhatsApp) tidak masuk ranking.
          </p>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.16em] text-mute">
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-2 py-3 font-medium">Anggota</th>
                    <th className="px-2 py-3 font-medium">Pesan</th>
                    <th className="hidden px-2 py-3 font-medium md:table-cell">Hari</th>
                    <th className="hidden px-2 py-3 font-medium lg:table-cell">Stiker</th>
                    <th className="hidden px-2 py-3 font-medium lg:table-cell">Gambar</th>
                    <th className="hidden px-2 py-3 font-medium xl:table-cell">Mention</th>
                    <th className="hidden px-2 py-3 font-medium xl:table-cell">Luar jam</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((m) => (
                    <tr key={m.name} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2.5 num text-mute">{m.rank}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{m.name}</span>
                          <span className="block h-1.5 max-w-[14rem] overflow-hidden rounded-sm bg-white/5">
                            <span
                              className="block h-full bg-gold"
                              style={{ width: `${(m.messages / maxMsg) * 100}%` }}
                            />
                          </span>
                          {badges(m, imo.roles).length ? (
                            <span className="flex flex-wrap gap-1">
                              {badges(m, imo.roles).map((b) => (
                                <span
                                  key={b}
                                  className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-gold"
                                >
                                  {b}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="num">{idNum(m.messages)}</span>
                        <span className="ml-1 text-xs text-mute">{m.sharePct.toString().replace(".", ",")}%</span>
                      </td>
                      <td className="hidden px-2 py-2.5 num md:table-cell">{idNum(m.activeDays)}</td>
                      <td className="hidden px-2 py-2.5 num lg:table-cell">{idNum(m.stickers)}</td>
                      <td className="hidden px-2 py-2.5 num lg:table-cell">{idNum(m.images)}</td>
                      <td className="hidden px-2 py-2.5 num xl:table-cell">{idNum(m.mentionsReceived)}</td>
                      <td className="hidden px-2 py-2.5 num xl:table-cell">
                        {m.afterHoursPct.toString().replace(".", ",")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {bot ? (
            <p className="mt-3 text-xs text-mute">
              Bot: {bot.name} · {idNum(bot.messages)} pesan, tidak dihitung di peringkat manusia.
            </p>
          ) : null}
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Peran di grup</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(imo.roles).map(([key, name]) =>
              name ? (
                <Card key={key} className="p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{ROLE_LABEL[key] ?? key}</p>
                  <p className="mt-1 text-base font-medium">{name}</p>
                </Card>
              ) : null,
            )}
          </div>
        </section>

        <section className="mt-12" id="topik">
          <h2 className="text-lg font-semibold">Topik yang dibahas</h2>
          <p className="mb-5 mt-1 max-w-2xl text-sm leading-6 text-mute">
            Dihitung dari kata kunci di pesan teks (satu pesan bisa kena lebih dari satu topik). Persentase
            terhadap {idNum(imo.totals.text)} pesan teks. Bukan isi chat — hanya kategori.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <ul className="space-y-3">
                {imo.topics.map((t) => (
                  <li key={t.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{t.label}</span>
                      <span className="num text-sm text-mute">
                        {idNum(t.messages)} · {t.sharePct.toString().replace(".", ",")}%
                      </span>
                    </div>
                    <p className="text-xs text-mute">{t.blurb}</p>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-sm bg-white/5">
                      <span
                        className="block h-full bg-gold"
                        style={{ width: `${(t.messages / maxTopic) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="mb-2 text-base font-medium">Pergeseran topik per tahun</h3>
              <p className="mb-4 text-xs text-mute">
                2021–22 masih soal rapat & pandemi. 2026 melonjak di KPI/KAI — sesuai musim alokasi.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.14em] text-mute">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-2 font-medium">Topik</th>
                      {imo.yearly.map((y) => (
                        <th key={y.year} className="py-2 text-right font-medium">
                          {y.year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {imo.topics.slice(0, 8).map((t) => (
                      <tr key={t.id} className="border-b border-line/50 last:border-0">
                        <td className="py-1.5 pr-2">{t.label}</td>
                        {imo.yearly.map((y) => (
                          <td key={y.year} className="num py-1.5 text-right">
                            {idNum(t.byYear[y.year as keyof typeof t.byYear] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </section>

        <section className="mt-12" id="waktu">
          <h2 className="text-lg font-semibold">Kapan grup ini hidup</h2>
          <p className="mb-5 mt-1 max-w-2xl text-sm leading-6 text-mute">
            Puncak 2023 (Juni 1.195 pesan). 2025 lebih sepi, lalu 2026 naik lagi — bertepatan dengan musim KPI.
            Selasa–Kamis adalah hari tersibuk.
          </p>
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <h3 className="mb-3 text-base font-medium">Pesan per bulan</h3>
              <MonthlyArea data={imo.monthly} />
            </Card>
            <Card className="lg:col-span-2">
              <h3 className="mb-3 text-base font-medium">Per tahun</h3>
              <YearBar data={imo.yearly} />
            </Card>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-base font-medium">Jam (WIB)</h3>
              <HourBar data={imo.hourly} />
            </Card>
            <Card>
              <h3 className="mb-3 text-base font-medium">Hari dalam seminggu</h3>
              <WeekdayBar data={imo.weekdays} />
            </Card>
          </div>
          <Card className="mt-4">
            <h3 className="mb-4 text-base font-medium">Heatmap jam × hari</h3>
            <Heatmap cells={imo.heatmap} />
          </Card>
          <Card className="mt-4">
            <h3 className="mb-3 text-base font-medium">Hari tersibuk</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {imo.peakDays.map((d) => (
                <li key={d.date} className="border border-line px-3 py-2">
                  <p className="text-xs text-mute">{dateLabel(d.date)}</p>
                  <p className="num text-lg">{idNum(d.count)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="mt-12" id="budaya">
          <h2 className="text-lg font-semibold">Budaya grup</h2>
          <p className="mb-5 mt-1 max-w-2xl text-sm leading-6 text-mute">
            Nama grup diganti 8 kali dalam 30 menit pertama, lalu menetap jadi IMO FACTORY. Panggilan internal
            paling sering: Her, Tifta, Ical.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-base font-medium">Evolusi nama grup</h3>
              <ol className="space-y-3">
                {imo.nameHistory.map((h, i) => (
                  <li key={`${h.at}-${h.name}`} className="flex gap-3">
                    <span className="num w-6 text-gold">{i + 1}</span>
                    <div>
                      <p className="font-medium">{h.name}</p>
                      <p className="text-xs text-mute">
                        {dateLabel(h.at)} · {h.by}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <Card>
              <h3 className="mb-4 text-base font-medium">Panggilan yang sering muncul</h3>
              <ul className="space-y-3">
                {imo.nicknames.map((n) => (
                  <li key={n.nick} className="flex items-baseline justify-between gap-3">
                    <span>
                      <span className="font-medium">“{n.nick}”</span>
                      <span className="text-sm text-mute"> → {n.refersTo}</span>
                    </span>
                    <span className="num text-sm text-mute">{idNum(n.count)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <h3 className="mb-3 text-base font-medium">Emoji paling sering</h3>
                <div className="flex flex-wrap gap-2">
                  {imo.topEmojis.map((e) => (
                    <span key={e.emoji} className="border border-line px-2 py-1 text-sm">
                      {e.emoji} <span className="num text-xs text-mute">{idNum(e.count)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          </div>
          <Card className="mt-4">
            <h3 className="mb-3 text-base font-medium">Kata yang sering muncul</h3>
            <p className="mb-3 text-xs text-mute">
              Setelah stopword bahasa gaul dibuang. Nada grup: keren, semoga, selamat, semangat, ngeri, BUMN.
            </p>
            <div className="flex flex-wrap gap-2">
              {imo.topWords.map((w, i) => (
                <span
                  key={w.word}
                  className={clsx(
                    "border border-line px-2 py-1 text-sm",
                    i < 8 ? "text-gold" : "text-foreground",
                  )}
                >
                  {w.word}
                  <span className="ml-1 num text-xs text-mute">{idNum(w.count)}</span>
                </span>
              ))}
            </div>
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-base font-medium">Jenis pesan</h3>
              <ul className="space-y-2">
                {imo.mix.map((m) => (
                  <li key={m.kind} className="flex justify-between text-sm">
                    <span>{m.kind}</span>
                    <span className="num">{idNum(m.count)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="mb-3 text-base font-medium">Situs yang sering dibagikan</h3>
              <p className="mb-3 text-xs text-mute">Host saja, tanpa URL lengkap. Zoom disembunyikan.</p>
              <ul className="space-y-2">
                {imo.urlHosts.map((u) => (
                  <li key={u.host} className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{u.host}</span>
                    <span className="num">{idNum(u.count)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          {imo.alumni.length ? (
            <Card className="mt-4">
              <h3 className="mb-3 text-base font-medium">Alumni (sepi &gt; 6 bulan)</h3>
              <ul className="grid gap-2 sm:grid-cols-3">
                {imo.alumni.map((a) => (
                  <li key={a.name} className="border border-line px-3 py-2">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-mute">
                      Terakhir {dateLabel(a.lastAt)} · {idNum(a.messages)} pesan
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-12">
        <div className="hairline mb-6" />
        <p className="text-sm leading-7 text-mute">{imo.meta.privacyNote}</p>
        <p className="mt-3 text-sm text-mute">
          Sumber: {imo.meta.source} · Dihitung {dateLabel(imo.meta.generatedAt)}.
        </p>
        <p className="mt-5 text-sm tracking-wide text-mute">IMO FACTORY analytics · {new Date().getFullYear()}</p>
      </footer>
    </>
  );
}
