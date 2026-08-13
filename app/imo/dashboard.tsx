"use client";

import { useMemo, useState } from "react";
import { HourBar, MonthlyArea, WeekdayBar, YearBar } from "@/components/imo-charts";
import { dateLabel, humans, idNum, imo, type ImoMember } from "@/lib/imo";

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
  const index = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cells) map.set(`${c.dow}-${c.hour}`, c.count);
    return map;
  }, [cells]);

  return (
    <div className="overflow-x-auto">
      <div className="imo-heat" style={{ marginBottom: 4 }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="imo-muted" style={{ fontSize: 10, textAlign: "center" }}>
            {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
          </span>
        ))}
      </div>
      {days.map((day, dow) => (
        <div key={day} className="imo-heat" style={{ marginBottom: 3 }}>
          <span className="imo-muted" style={{ fontSize: 12, alignSelf: "center" }}>
            {day}
          </span>
          {Array.from({ length: 24 }, (_, hour) => {
            const n = index.get(`${dow}-${hour}`) ?? 0;
            const t = n / max;
            return (
              <div
                key={hour}
                className="cell"
                title={`${day} ${String(hour).padStart(2, "0")}.00 · ${idNum(n)} pesan`}
                style={{
                  background:
                    n === 0 ? "var(--imo-fill)" : `rgba(0, 122, 255, ${0.14 + t * 0.78})`,
                }}
              />
            );
          })}
        </div>
      ))}
      <p className="imo-muted" style={{ fontSize: 12, marginTop: 12 }}>
        Abu-abu = sepi · biru = ramai, seperti Screen Time.
      </p>
    </div>
  );
}

function CopyLink() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="imo-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
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

function Widget({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="imo-card">
      <div className="imo-stat-l">{label}</div>
      <div className="imo-stat-v">{value}</div>
      {hint ? <div className="imo-stat-h">{hint}</div> : null}
    </div>
  );
}

export function ImoDashboard() {
  const people = useMemo(() => humans(), []);
  const maxMsg = people[0]?.messages ?? 1;
  const maxTopic = imo.topics[0]?.messages ?? 1;
  const bot = imo.members.find((m) => m.bot);

  return (
    <div className="imo-shell">
      <header className="imo-nav">
        <div className="imo-wrap imo-nav-inner">
          <div className="imo-brand">
            <span className="imo-mark" aria-hidden />
            IMO Factory
          </div>
          <nav className="imo-toc">
            {TOC.map((t) => (
              <a key={t.href} href={t.href}>
                {t.label}
              </a>
            ))}
          </nav>
          <CopyLink />
        </div>
      </header>

      <main className="imo-wrap">
        <header className="imo-hero" id="ringkasan">
          <p className="imo-kicker">Analitik grup WhatsApp</p>
          <h1 className="imo-title">Siapa yang paling ramai di IMO</h1>
          <p className="imo-lead">
            {idNum(imo.totals.messages)} pesan dari {dateLabel(imo.meta.firstMessageAt)} sampai{" "}
            {dateLabel(imo.meta.lastMessageAt)}. Ranking anggota, topik, dan pola waktu — tanpa isi
            chat, tanpa nomor telepon, tanpa sandi rapat.
          </p>
        </header>

        <div className="imo-grid imo-g4">
          <Widget
            label="Pesan"
            value={idNum(imo.totals.messages)}
            hint={`${idNum(imo.totals.avgPerDay)} / hari kalender`}
          />
          <Widget
            label="Anggota"
            value={idNum(imo.totals.members)}
            hint={`${idNum(imo.totals.activeDays)} hari ada obrolan`}
          />
          <Widget
            label="Usia grup"
            value={`${idNum(imo.meta.spanDays)} hari`}
            hint={`${dateLabel(imo.meta.firstMessageAt)} – ${dateLabel(imo.meta.lastMessageAt)}`}
          />
          <Widget
            label="Top 5 menulis"
            value={`${imo.totals.top5SharePct.toString().replace(".", ",")}%`}
            hint="Hermawan, Danti, Lucky, Tifta, Fajar"
          />
        </div>

        <div className="imo-grid imo-g3" style={{ marginTop: 12 }}>
          <Widget
            label="Jam kantor 09–18"
            value={`${idNum(imo.totals.officePct, 0)}%`}
            hint="Hidup di hari kerja"
          />
          <Widget label="Akhir pekan" value={`${imo.totals.weekendPct.toString().replace(".", ",")}%`} />
          <Widget
            label="Stiker / gambar"
            value={`${idNum(imo.totals.stickers)} / ${idNum(imo.totals.images)}`}
          />
        </div>

        <h2 className="imo-h2">Highlight</h2>
        <div className="imo-grid imo-g3">
          {imo.highlights.map((h) => (
            <article key={h.title} className="imo-card">
              <div className="imo-stat-l" style={{ color: "var(--imo-blue)" }}>
                {h.kicker}
              </div>
              <h3 className="imo-h3" style={{ marginTop: 8 }}>
                {h.title}
              </h3>
              <p className="imo-muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.47 }}>
                {h.body}
              </p>
            </article>
          ))}
        </div>

        <section id="anggota">
          <h2 className="imo-h2">Peringkat anggota</h2>
          <p className="imo-note">
            Diurutkan dari jumlah pesan. Danti paling sering hadir, Lucky paling banyak stiker, Tifta
            paling banyak gambar. Meta AI tidak masuk ranking.
          </p>
          <div className="imo-card imo-card-flush">
            <div className="overflow-x-auto">
              <table className="imo-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Anggota</th>
                    <th>Pesan</th>
                    <th className="hidden md:table-cell">Hari</th>
                    <th className="hidden lg:table-cell">Stiker</th>
                    <th className="hidden lg:table-cell">Gambar</th>
                    <th className="hidden xl:table-cell">Mention</th>
                    <th className="hidden xl:table-cell">Luar jam</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((m) => (
                    <tr key={m.name}>
                      <td>
                        <span className={m.rank && m.rank <= 3 ? "imo-rank is-top" : "imo-rank"}>
                          {m.rank}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontWeight: 590 }}>{m.name}</strong>
                        <span className="imo-bar">
                          <i style={{ width: `${(m.messages / maxMsg) * 100}%` }} />
                        </span>
                        {badges(m, imo.roles).map((b) => (
                          <span key={b} className="imo-chip">
                            {b}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className="imo-num">{idNum(m.messages)}</span>
                        <span className="imo-muted" style={{ marginLeft: 6, fontSize: 13 }}>
                          {m.sharePct.toString().replace(".", ",")}%
                        </span>
                      </td>
                      <td className="imo-num hidden md:table-cell">{idNum(m.activeDays)}</td>
                      <td className="imo-num hidden lg:table-cell">{idNum(m.stickers)}</td>
                      <td className="imo-num hidden lg:table-cell">{idNum(m.images)}</td>
                      <td className="imo-num hidden xl:table-cell">{idNum(m.mentionsReceived)}</td>
                      <td className="imo-num hidden xl:table-cell">
                        {m.afterHoursPct.toString().replace(".", ",")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {bot ? (
            <p className="imo-muted" style={{ fontSize: 13, marginTop: 10 }}>
              Bot: {bot.name} · {idNum(bot.messages)} pesan, tidak dihitung di peringkat manusia.
            </p>
          ) : null}
        </section>

        <h2 className="imo-h2">Peran di grup</h2>
        <div className="imo-grid imo-g3">
          {Object.entries(imo.roles).map(([key, name]) =>
            name ? (
              <div key={key} className="imo-card">
                <div className="imo-stat-l">{ROLE_LABEL[key] ?? key}</div>
                <div style={{ marginTop: 6, fontWeight: 590 }}>{name}</div>
              </div>
            ) : null,
          )}
        </div>

        <section id="topik">
          <h2 className="imo-h2">Topik yang dibahas</h2>
          <p className="imo-note">
            Dari kata kunci di pesan teks. Satu pesan bisa kena lebih dari satu topik. Persentase
            terhadap {idNum(imo.totals.text)} pesan teks.
          </p>
          <div className="imo-grid imo-g2">
            <div className="imo-card">
              {imo.topics.map((t) => (
                <div key={t.id} style={{ margin: "14px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontWeight: 590 }}>{t.label}</strong>
                    <span className="imo-num imo-muted" style={{ fontSize: 13 }}>
                      {idNum(t.messages)} · {t.sharePct.toString().replace(".", ",")}%
                    </span>
                  </div>
                  <div className="imo-muted" style={{ fontSize: 13 }}>
                    {t.blurb}
                  </div>
                  <span className="imo-bar" style={{ maxWidth: "none" }}>
                    <i style={{ width: `${(t.messages / maxTopic) * 100}%` }} />
                  </span>
                </div>
              ))}
            </div>
            <div className="imo-card">
              <h3 className="imo-h3">Pergeseran per tahun</h3>
              <p className="imo-muted" style={{ fontSize: 13, marginTop: 0 }}>
                2026 melonjak di KPI/KAI — musim alokasi.
              </p>
              <div className="overflow-x-auto">
                <table className="imo-table" style={{ minWidth: "28rem" }}>
                  <thead>
                    <tr>
                      <th>Topik</th>
                      {imo.yearly.map((y) => (
                        <th key={y.year} style={{ textAlign: "right" }}>
                          {y.year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {imo.topics.slice(0, 8).map((t) => (
                      <tr key={t.id}>
                        <td>{t.label}</td>
                        {imo.yearly.map((y) => (
                          <td key={y.year} className="imo-num" style={{ textAlign: "right" }}>
                            {idNum(t.byYear[y.year as keyof typeof t.byYear] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="waktu">
          <h2 className="imo-h2">Kapan grup ini hidup</h2>
          <p className="imo-note">
            Puncak 2023. 2025 lebih sepi, 2026 naik lagi. Selasa–Kamis tersibuk. Hampir tidak ada
            chat akhir pekan.
          </p>
          <div className="imo-grid imo-g-time">
            <div className="imo-card">
              <h3 className="imo-h3">Pesan per bulan</h3>
              <MonthlyArea data={imo.monthly} />
            </div>
            <div className="imo-card">
              <h3 className="imo-h3">Per tahun</h3>
              <YearBar data={imo.yearly} />
            </div>
          </div>
          <div className="imo-grid imo-g2" style={{ marginTop: 12 }}>
            <div className="imo-card">
              <h3 className="imo-h3">Jam (WIB)</h3>
              <HourBar data={imo.hourly} />
            </div>
            <div className="imo-card">
              <h3 className="imo-h3">Hari dalam seminggu</h3>
              <WeekdayBar data={imo.weekdays} />
            </div>
          </div>
          <div className="imo-card" style={{ marginTop: 12 }}>
            <h3 className="imo-h3">Heatmap jam × hari</h3>
            <Heatmap cells={imo.heatmap} />
          </div>
          <div className="imo-card" style={{ marginTop: 12 }}>
            <h3 className="imo-h3">Hari tersibuk</h3>
            <div className="imo-grid imo-g3">
              {imo.peakDays.map((d) => (
                <div
                  key={d.date}
                  style={{
                    background: "var(--imo-fill)",
                    borderRadius: 14,
                    padding: "12px 14px",
                  }}
                >
                  <div className="imo-muted" style={{ fontSize: 13 }}>
                    {dateLabel(d.date)}
                  </div>
                  <div className="imo-num" style={{ fontSize: 22, fontWeight: 700 }}>
                    {idNum(d.count)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="budaya">
          <h2 className="imo-h2">Budaya grup</h2>
          <p className="imo-note">
            Nama grup diganti 8 kali di 30 menit pertama, lalu menetap IMO FACTORY. Panggilan
            internal: Her, Tifta, Ical.
          </p>
          <div className="imo-grid imo-g2">
            <div className="imo-card">
              <h3 className="imo-h3">Evolusi nama grup</h3>
              <ol style={{ margin: 0, paddingLeft: 22 }}>
                {imo.nameHistory.map((h) => (
                  <li key={`${h.at}-${h.name}`} style={{ margin: "10px 0" }}>
                    <strong style={{ fontWeight: 590 }}>{h.name}</strong>
                    <div className="imo-muted" style={{ fontSize: 13 }}>
                      {dateLabel(h.at)} · {h.by}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="imo-card">
              <h3 className="imo-h3">Panggilan yang sering muncul</h3>
              {imo.nicknames.map((n) => (
                <div key={n.nick} className="imo-list-row">
                  <span>
                    <strong style={{ fontWeight: 590 }}>“{n.nick}”</strong>
                    <span className="imo-muted"> → {n.refersTo}</span>
                  </span>
                  <span className="imo-num imo-muted">{idNum(n.count)}</span>
                </div>
              ))}
              <h3 className="imo-h3" style={{ marginTop: 22 }}>
                Emoji paling sering
              </h3>
              {imo.topEmojis.map((e) => (
                <span key={e.emoji} className="imo-pill">
                  {e.emoji} <span className="imo-num imo-muted">{idNum(e.count)}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="imo-card" style={{ marginTop: 12 }}>
            <h3 className="imo-h3">Kata yang sering muncul</h3>
            <p className="imo-muted" style={{ fontSize: 13 }}>
              Nada grup: keren, semoga, selamat, semangat, ngeri, BUMN.
            </p>
            {imo.topWords.map((w, i) => (
              <span key={w.word} className={i < 8 ? "imo-pill is-hot" : "imo-pill"}>
                {w.word}
                <span className="imo-num imo-muted">{idNum(w.count)}</span>
              </span>
            ))}
          </div>
          <div className="imo-grid imo-g2" style={{ marginTop: 12 }}>
            <div className="imo-card">
              <h3 className="imo-h3">Jenis pesan</h3>
              {imo.mix.map((m) => (
                <div key={m.kind} className="imo-list-row">
                  <span>{m.kind}</span>
                  <span className="imo-num">{idNum(m.count)}</span>
                </div>
              ))}
            </div>
            <div className="imo-card">
              <h3 className="imo-h3">Situs yang sering dibagikan</h3>
              <p className="imo-muted" style={{ fontSize: 13, marginTop: 0 }}>
                Host saja. Zoom disembunyikan.
              </p>
              {imo.urlHosts.map((u) => (
                <div key={u.host} className="imo-list-row">
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.host}</span>
                  <span className="imo-num">{idNum(u.count)}</span>
                </div>
              ))}
            </div>
          </div>
          {imo.alumni.length ? (
            <div className="imo-card" style={{ marginTop: 12 }}>
              <h3 className="imo-h3">Alumni (sepi &gt; 6 bulan)</h3>
              <div className="imo-grid imo-g3">
                {imo.alumni.map((a) => (
                  <div
                    key={a.name}
                    style={{ background: "var(--imo-fill)", borderRadius: 14, padding: "12px 14px" }}
                  >
                    <div style={{ fontWeight: 590 }}>{a.name}</div>
                    <div className="imo-muted" style={{ fontSize: 13 }}>
                      Terakhir {dateLabel(a.lastAt)} · {idNum(a.messages)} pesan
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <footer className="imo-footer">
          <p>{imo.meta.privacyNote}</p>
          <p>
            Sumber: {imo.meta.source} · Dihitung {dateLabel(imo.meta.generatedAt)}.
          </p>
          <p>IMO Factory · {new Date().getFullYear()}</p>
        </footer>
      </main>
    </div>
  );
}
