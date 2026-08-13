#!/usr/bin/env python3
"""Build a self-contained public HTML dashboard from imo-analytics.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/workspace")
DATA = json.loads((ROOT / "data/imo-analytics.json").read_text(encoding="utf-8"))
OUT = ROOT / "public/imo.html"

HTML = r"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IMO FACTORY — Analitik grup WhatsApp</title>
  <meta name="description" content="Dashboard publik analitik grup WhatsApp IMO Pelindo/IPC: anggota paling aktif, topik, dan pola waktu 2021–2026." />
  <meta name="robots" content="index,follow" />
  <meta property="og:title" content="IMO FACTORY — Analitik grup WhatsApp" />
  <meta property="og:description" content="29 ribu pesan, 24 anggota, 5 tahun obrolan. Ranking keaktifan, topik, dan pola jam kerja." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #050505;
      --fg: #f2eee6;
      --card: #0c0c0c;
      --line: rgba(201,162,79,.16);
      --gold: #c9a24f;
      --mute: #c4bcb2;
      --up: #9cba8a;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: var(--bg); color: var(--fg); }
    body {
      font-family: Outfit, ui-sans-serif, system-ui, sans-serif;
      font-size: 16px;
      background-image:
        radial-gradient(900px 480px at 50% -20%, rgba(201,162,79,.09), transparent 58%),
        radial-gradient(700px 360px at 100% 100%, rgba(80,40,20,.18), transparent 50%);
    }
    a { color: var(--gold); text-decoration: none; }
    .wrap { max-width: 1120px; margin: 0 auto; padding: 0 16px 64px; }
    header.top {
      position: sticky; top: 0; z-index: 20;
      backdrop-filter: blur(16px);
      background: rgba(5,5,5,.8);
      border-bottom: 1px solid var(--line);
    }
    .top-inner { max-width: 1120px; margin: 0 auto; padding: 14px 16px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    .kicker { font-size: 10px; letter-spacing: .34em; text-transform: uppercase; color: var(--gold); margin: 0; }
    .brand { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-size: 1.35rem; margin: 2px 0 0; }
    .brand span { font-style: normal; color: var(--gold); }
    nav { display: flex; gap: 16px; flex-wrap: wrap; }
    nav a { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--mute); }
    nav a:hover { color: var(--gold); }
    h1 { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-weight: 500; font-size: clamp(2.4rem, 6vw, 3.6rem); line-height: 1.05; margin: 12px 0 0; }
    h2 { font-size: 1.15rem; margin: 48px 0 8px; }
    h3 { font-size: 1rem; margin: 0 0 12px; }
    .lead { max-width: 40rem; color: var(--mute); line-height: 1.8; }
    .hair { height: 1px; max-width: 16rem; margin: 18px 0; background: linear-gradient(90deg, transparent, rgba(201,162,79,.45), transparent); }
    .grid { display: grid; gap: 14px; }
    .g4 { grid-template-columns: repeat(4, 1fr); }
    .g3 { grid-template-columns: repeat(3, 1fr); }
    .g2 { grid-template-columns: repeat(2, 1fr); }
    .card {
      background: linear-gradient(180deg, rgba(18,18,18,.94), rgba(8,8,8,.96));
      border: 1px solid var(--line);
      padding: 20px;
    }
    .stat-l { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--mute); }
    .stat-v { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 1.6rem; margin-top: 6px; }
    .stat-h { color: var(--mute); font-size: .85rem; margin-top: 4px; }
    .gold { color: var(--gold); }
    .mute { color: var(--mute); }
    .num { font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    th { text-align: left; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); font-weight: 500; padding: 8px 6px; border-bottom: 1px solid var(--line); }
    td { padding: 9px 6px; border-bottom: 1px solid rgba(201,162,79,.08); vertical-align: top; }
    .bar { height: 6px; background: rgba(255,255,255,.05); overflow: hidden; margin-top: 5px; max-width: 220px; }
    .bar > i { display: block; height: 100%; background: var(--gold); }
    .badge { display: inline-block; border: 1px solid var(--line); color: var(--gold); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; padding: 2px 6px; margin: 2px 4px 0 0; }
    .pill { border: 1px solid var(--line); padding: 6px 10px; display: inline-block; margin: 0 6px 6px 0; font-size: .9rem; }
    .heat { display: grid; grid-template-columns: 36px repeat(24, 1fr); gap: 2px; min-width: 700px; }
    .heat .h { height: 18px; }
    .scroll { overflow-x: auto; }
    footer { color: var(--mute); font-size: .9rem; line-height: 1.7; margin-top: 48px; }
    @media (max-width: 900px) {
      .g4, .g3 { grid-template-columns: 1fr 1fr; }
      nav { display: none; }
    }
    @media (max-width: 560px) {
      .g4, .g3, .g2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="top-inner">
      <div>
        <p class="kicker">Dashboard publik</p>
        <p class="brand">IMO <span>FACTORY</span></p>
      </div>
      <nav>
        <a href="#ringkasan">Ringkasan</a>
        <a href="#anggota">Anggota</a>
        <a href="#topik">Topik</a>
        <a href="#waktu">Waktu</a>
        <a href="#budaya">Budaya</a>
      </nav>
    </div>
  </header>
  <div class="wrap" id="app"></div>
  <script id="data" type="application/json">__DATA__</script>
  <script>
    const D = JSON.parse(document.getElementById("data").textContent);
    const idn = (n, d=0) => new Intl.NumberFormat("id-ID", {maximumFractionDigits:d, minimumFractionDigits:d}).format(n);
    const dlab = (iso) => new Date(iso+"T00:00:00").toLocaleDateString("id-ID", {day:"numeric", month:"short", year:"numeric"});
    const mlab = (ym) => {
      const names = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      const [y,m] = ym.split("-");
      return names[+m-1] + " " + y.slice(2);
    };
    const people = D.members.filter(m => !m.bot);
    const maxMsg = people[0].messages;
    const maxTopic = D.topics[0].messages;
    const roles = {
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
    const badges = (m) => Object.entries(D.roles).filter(([,v]) => v === m.name).map(([k]) => roles[k]).concat(m.alumni ? ["Alumni"] : []);

    function area(monthly) {
      const w=720, h=200, p=28;
      const max = Math.max(...monthly.map(x=>x.count));
      const pts = monthly.map((x,i) => {
        const X = p + i * ((w-2*p) / (monthly.length-1));
        const Y = h-p - (x.count/max)*(h-2*p);
        return [X,Y];
      });
      const d = pts.map((p,i)=> (i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
      const fill = d + ` L${pts.at(-1)[0]},${h-p} L${pts[0][0]},${h-p} Z`;
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="220" preserveAspectRatio="none">
        <path d="${fill}" fill="rgba(201,162,79,.22)"/>
        <path d="${d}" fill="none" stroke="#c9a24f" stroke-width="2"/>
      </svg>`;
    }

    function bars(items, key, labelKey) {
      const max = Math.max(...items.map(x=>x[key]));
      return items.map(x => {
        const pct = (x[key]/max)*100;
        return `<div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;font-size:13px">
            <span>${x[labelKey]}</span><span class="num mute">${idn(x[key])}</span>
          </div>
          <div class="bar" style="max-width:none"><i style="width:${pct}%"></i></div>
        </div>`;
      }).join("");
    }

    const heatMax = Math.max(...D.heatmap.map(c=>c.count), 1);
    const days = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
    let heat = `<div class="scroll"><div class="heat">
      <div></div>${[...Array(24)].map((_,h)=>`<div class="mute" style="font-size:10px;text-align:center">${h%3===0?String(h).padStart(2,"0"):""}</div>`).join("")}`;
    days.forEach((day, dow) => {
      heat += `<div class="mute" style="font-size:11px;align-self:center">${day}</div>`;
      for (let h=0;h<24;h++) {
        const n = (D.heatmap.find(c=>c.dow===dow && c.hour===h)||{count:0}).count;
        const t = n/heatMax;
        const bg = n===0 ? "rgba(255,255,255,.035)" : `rgba(201,162,79,${0.12+t*0.78})`;
        heat += `<div class="h" title="${day} ${String(h).padStart(2,"0")}.00 · ${idn(n)}" style="background:${bg}"></div>`;
      }
    });
    heat += `</div></div>`;

    document.getElementById("app").innerHTML = `
      <section id="ringkasan" style="padding-top:40px">
        <p class="kicker">WhatsApp group analytics</p>
        <h1>Siapa yang paling ramai di IMO</h1>
        <div class="hair"></div>
        <p class="lead">Agregat ${idn(D.totals.messages)} pesan dari ${dlab(D.meta.firstMessageAt)} sampai ${dlab(D.meta.lastMessageAt)}. Ranking anggota, topik, dan pola waktu — tanpa isi chat, tanpa nomor telepon, tanpa sandi rapat.</p>
      </section>
      <div class="grid g4" style="margin-top:28px">
        <div class="card"><div class="stat-l">Pesan</div><div class="stat-v">${idn(D.totals.messages)}</div><div class="stat-h">${idn(D.totals.avgPerDay,1)} / hari kalender</div></div>
        <div class="card"><div class="stat-l">Anggota</div><div class="stat-v">${idn(D.totals.members)}</div><div class="stat-h">${idn(D.totals.activeDays)} hari ada obrolan</div></div>
        <div class="card"><div class="stat-l">Usia grup</div><div class="stat-v">${idn(D.meta.spanDays)} hari</div><div class="stat-h">${dlab(D.meta.firstMessageAt)} – ${dlab(D.meta.lastMessageAt)}</div></div>
        <div class="card"><div class="stat-l">Top 5 menulis</div><div class="stat-v">${String(D.totals.top5SharePct).replace(".",",")}%</div><div class="stat-h">Hermawan, Danti, Lucky, Tifta, Fajar</div></div>
      </div>
      <div class="grid g3" style="margin-top:14px">
        <div class="card"><div class="stat-l">Jam kantor 09–18</div><div class="stat-v">${idn(D.totals.officePct,0)}%</div></div>
        <div class="card"><div class="stat-l">Akhir pekan</div><div class="stat-v">${String(D.totals.weekendPct).replace(".",",")}%</div></div>
        <div class="card"><div class="stat-l">Stiker / gambar</div><div class="stat-v">${idn(D.totals.stickers)} / ${idn(D.totals.images)}</div></div>
      </div>
      <h2>Highlight yang perlu dilihat</h2>
      <div class="grid g3">
        ${D.highlights.map(h=>`<div class="card"><div class="stat-l">${h.kicker}</div><h3 style="margin-top:8px">${h.title}</h3><p class="mute" style="font-size:.9rem;line-height:1.6">${h.body}</p></div>`).join("")}
      </div>

      <h2 id="anggota">Peringkat anggota paling aktif</h2>
      <p class="lead">Diurutkan dari jumlah pesan. Danti memimpin hari kehadiran, Lucky stiker, Tifta gambar. Meta AI tidak masuk ranking.</p>
      <div class="card scroll" style="margin-top:16px;padding:8px 12px">
        <table>
          <thead><tr><th>#</th><th>Anggota</th><th>Pesan</th><th>Hari</th><th>Stiker</th><th>Gambar</th><th>Mention</th><th>Luar jam</th></tr></thead>
          <tbody>
            ${people.map(m=>`<tr>
              <td class="num mute">${m.rank}</td>
              <td><strong>${m.name}</strong>
                <div class="bar"><i style="width:${(m.messages/maxMsg)*100}%"></i></div>
                ${badges(m).map(b=>`<span class="badge">${b}</span>`).join("")}
              </td>
              <td class="num">${idn(m.messages)} <span class="mute">${String(m.sharePct).replace(".",",")}%</span></td>
              <td class="num">${idn(m.activeDays)}</td>
              <td class="num">${idn(m.stickers)}</td>
              <td class="num">${idn(m.images)}</td>
              <td class="num">${idn(m.mentionsReceived)}</td>
              <td class="num">${String(m.afterHoursPct).replace(".",",")}%</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <h2>Peran di grup</h2>
      <div class="grid g3">
        ${Object.entries(D.roles).map(([k,v]) => v ? `<div class="card"><div class="stat-l">${roles[k]}</div><div style="margin-top:6px;font-weight:500">${v}</div></div>` : "").join("")}
      </div>

      <h2 id="topik">Topik yang dibahas</h2>
      <p class="lead">Dari kata kunci di pesan teks. Satu pesan bisa kena lebih dari satu topik. Persentase terhadap ${idn(D.totals.text)} pesan teks.</p>
      <div class="grid g2" style="margin-top:16px">
        <div class="card">
          ${D.topics.map(t=>`<div style="margin:12px 0">
            <div style="display:flex;justify-content:space-between;gap:8px"><strong>${t.label}</strong><span class="num mute">${idn(t.messages)} · ${String(t.sharePct).replace(".",",")}%</span></div>
            <div class="mute" style="font-size:12px">${t.blurb}</div>
            <div class="bar" style="max-width:none"><i style="width:${(t.messages/maxTopic)*100}%"></i></div>
          </div>`).join("")}
        </div>
        <div class="card">
          <h3>Pergeseran topik per tahun</h3>
          <p class="mute" style="font-size:12px;margin-top:0">2026 melonjak di KPI/KAI — musim alokasi.</p>
          <div class="scroll">
            <table>
              <thead><tr><th>Topik</th>${D.yearly.map(y=>`<th style="text-align:right">${y.year}</th>`).join("")}</tr></thead>
              <tbody>
                ${D.topics.slice(0,8).map(t=>`<tr><td>${t.label}</td>${D.yearly.map(y=>`<td class="num" style="text-align:right">${idn(t.byYear[y.year]||0)}</td>`).join("")}</tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 id="waktu">Kapan grup ini hidup</h2>
      <p class="lead">Puncak 2023. 2025 lebih sepi, 2026 naik lagi. Selasa–Kamis tersibuk. Hampir tidak ada chat akhir pekan.</p>
      <div class="card" style="margin-top:16px">
        <h3>Pesan per bulan</h3>
        ${area(D.monthly)}
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h3>Per tahun</h3>${bars(D.yearly,"count","year")}</div>
        <div class="card"><h3>Hari dalam seminggu</h3>${bars(D.weekdays,"count","day")}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Jam (WIB)</h3>
        ${bars(D.hourly.map(x=>({...x, label: String(x.hour).padStart(2,"0")})),"count","label")}
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Heatmap jam × hari</h3>
        ${heat}
        <p class="mute" style="font-size:12px;margin-top:10px">Gelap = sepi · emas = ramai.</p>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Hari tersibuk</h3>
        <div class="grid g3">
          ${D.peakDays.map(d=>`<div style="border:1px solid var(--line);padding:10px"><div class="mute" style="font-size:12px">${dlab(d.date)}</div><div class="num" style="font-size:1.2rem">${idn(d.count)}</div></div>`).join("")}
        </div>
      </div>

      <h2 id="budaya">Budaya grup</h2>
      <p class="lead">Nama grup diganti 8 kali di 30 menit pertama, lalu menetap IMO FACTORY. Panggilan internal: Her, Tifta, Ical.</p>
      <div class="grid g2" style="margin-top:16px">
        <div class="card">
          <h3>Evolusi nama grup</h3>
          <ol style="padding-left:20px">
            ${D.nameHistory.map(h=>`<li style="margin:10px 0"><strong>${h.name}</strong><div class="mute" style="font-size:12px">${dlab(h.at)} · ${h.by}</div></li>`).join("")}
          </ol>
        </div>
        <div class="card">
          <h3>Panggilan yang sering muncul</h3>
          ${D.nicknames.map(n=>`<div style="display:flex;justify-content:space-between;margin:8px 0"><span><strong>“${n.nick}”</strong> <span class="mute">→ ${n.refersTo}</span></span><span class="num mute">${idn(n.count)}</span></div>`).join("")}
          <h3 style="margin-top:22px">Emoji paling sering</h3>
          ${D.topEmojis.map(e=>`<span class="pill">${e.emoji} <span class="num mute">${idn(e.count)}</span></span>`).join("")}
        </div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Kata yang sering muncul</h3>
        <p class="mute" style="font-size:12px">Nada grup: keren, semoga, selamat, semangat, ngeri, BUMN.</p>
        ${D.topWords.map((w,i)=>`<span class="pill ${i<8?"gold":""}">${w.word} <span class="num mute">${idn(w.count)}</span></span>`).join("")}
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h3>Jenis pesan</h3>${D.mix.map(m=>`<div style="display:flex;justify-content:space-between;margin:6px 0"><span>${m.kind}</span><span class="num">${idn(m.count)}</span></div>`).join("")}</div>
        <div class="card"><h3>Situs yang sering dibagikan</h3><p class="mute" style="font-size:12px">Host saja. Zoom disembunyikan.</p>${D.urlHosts.map(u=>`<div style="display:flex;justify-content:space-between;gap:8px;margin:6px 0"><span>${u.host}</span><span class="num">${idn(u.count)}</span></div>`).join("")}</div>
      </div>
      ${D.alumni.length?`<div class="card" style="margin-top:14px"><h3>Alumni (sepi &gt; 6 bulan)</h3><div class="grid g3">${D.alumni.map(a=>`<div style="border:1px solid var(--line);padding:10px"><strong>${a.name}</strong><div class="mute" style="font-size:12px">Terakhir ${dlab(a.lastAt)} · ${idn(a.messages)} pesan</div></div>`).join("")}</div></div>`:""}

      <footer>
        <div class="hair" style="max-width:none"></div>
        <p>${D.meta.privacyNote}</p>
        <p>Sumber: ${D.meta.source} · Dihitung ${dlab(D.meta.generatedAt)}.</p>
        <p>IMO FACTORY analytics · 2026</p>
      </footer>
    `;
  </script>
</body>
</html>
"""

payload = json.dumps(DATA, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
OUT.write_text(HTML.replace("__DATA__", payload), encoding="utf-8")
print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
