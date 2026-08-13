#!/usr/bin/env python3
"""Build a self-contained public HTML dashboard (iOS / macOS visual language)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data/imo-analytics.json").read_text(encoding="utf-8"))
OUT = ROOT / "public/imo.html"

HTML = r"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <title>IMO Factory — Analitik grup WhatsApp</title>
  <meta name="description" content="Dashboard publik analitik grup WhatsApp IMO Pelindo/IPC." />
  <style>
    :root {
      --bg:#f5f5f7; --card:#fff; --label:#1d1d1f; --sec:#6e6e73; --ter:#86868b;
      --blue:#007aff; --green:#34c759; --fill:rgba(120,120,128,.12);
      --sep:rgba(60,60,67,.12); --radius:20px;
      --shadow:0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
      --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg:#000; --card:#1c1c1e; --label:#f5f5f7; --sec:#98989d; --ter:#636366;
        --blue:#0a84ff; --green:#30d158; --fill:rgba(120,120,128,.24);
        --sep:rgba(84,84,88,.65); --shadow:0 0 0 .5px rgba(255,255,255,.08);
      }
    }
    * { box-sizing:border-box; }
    html,body { margin:0; background:var(--bg); color:var(--label); font-family:var(--font); font-size:17px; letter-spacing:-.022em; }
    a { color:var(--blue); text-decoration:none; }
    .wrap { width:min(1080px, calc(100% - 32px)); margin:0 auto; }
    header.top { position:sticky; top:0; z-index:20; backdrop-filter:saturate(180%) blur(20px); background:color-mix(in srgb, var(--bg) 72%, transparent); border-bottom:.5px solid var(--sep); }
    .top-inner { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; }
    .brand { display:flex; align-items:center; gap:10px; font-weight:590; }
    .mark { width:28px; height:28px; border-radius:8px; background:linear-gradient(180deg,#64b5ff,#007aff); }
    nav { display:none; gap:4px; padding:3px; border-radius:10px; background:var(--fill); }
    nav a { color:var(--label); font-size:13px; font-weight:510; padding:6px 10px; border-radius:8px; }
    .btn { background:var(--blue); color:#fff; border:0; font:inherit; font-size:15px; font-weight:590; padding:8px 14px; border-radius:980px; cursor:pointer; }
    h1 { font-size:clamp(34px,6vw,48px); font-weight:700; letter-spacing:-.035em; line-height:1.05; margin:8px 0 0; }
    h2 { font-size:22px; font-weight:700; letter-spacing:-.03em; margin:40px 0 6px; }
    h3 { font-size:17px; font-weight:590; margin:0 0 12px; }
    .kicker { color:var(--blue); font-size:13px; font-weight:590; text-transform:uppercase; margin:36px 0 0; }
    .lead,.note { color:var(--sec); font-size:17px; line-height:1.47; max-width:38rem; }
    .note { font-size:15px; margin:0 0 16px; }
    .grid { display:grid; gap:12px; }
    .g4 { grid-template-columns:repeat(4,1fr); }
    .g3 { grid-template-columns:repeat(3,1fr); }
    .g2 { grid-template-columns:repeat(2,1fr); }
    .card { background:var(--card); border-radius:var(--radius); box-shadow:var(--shadow); padding:20px; }
    .stat-l { color:var(--sec); font-size:13px; font-weight:590; }
    .stat-v { margin-top:4px; font-size:28px; font-weight:700; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
    .stat-h { margin-top:2px; color:var(--ter); font-size:13px; }
    table { width:100%; border-collapse:collapse; font-size:15px; }
    th { text-align:left; color:var(--ter); font-size:12px; font-weight:590; padding:12px 10px; border-bottom:.5px solid var(--sep); }
    td { padding:12px 10px; border-bottom:.5px solid var(--sep); vertical-align:top; }
    tr:last-child td { border-bottom:0; }
    .rank { display:inline-flex; width:26px; height:26px; align-items:center; justify-content:center; border-radius:50%; background:var(--fill); font-size:13px; font-weight:590; }
    .rank.top { background:var(--blue); color:#fff; }
    .bar { height:6px; max-width:220px; margin-top:6px; border-radius:100px; background:var(--fill); overflow:hidden; }
    .bar>i { display:block; height:100%; background:var(--blue); }
    .chip { display:inline-block; margin:4px 6px 0 0; padding:3px 8px; border-radius:100px; background:rgba(0,122,255,.12); color:var(--blue); font-size:11px; font-weight:590; }
    .pill { display:inline-flex; gap:6px; margin:0 8px 8px 0; padding:7px 12px; border-radius:100px; background:var(--fill); font-size:14px; }
    .row { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:.5px solid var(--sep); }
    .row:last-child { border-bottom:0; }
    .num { font-variant-numeric:tabular-nums; }
    .mute { color:var(--sec); }
    .heat { display:grid; grid-template-columns:36px repeat(24,1fr); gap:3px; min-width:700px; }
    .cell { height:16px; border-radius:4px; }
    footer { padding:40px 0 56px; color:var(--ter); font-size:13px; line-height:1.5; }
    @media (min-width:860px) { nav { display:flex; } }
    @media (max-width:960px) { .g4 { grid-template-columns:1fr 1fr; } }
    @media (max-width:700px) { .g4,.g3,.g2 { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header class="top"><div class="wrap top-inner">
    <div class="brand"><span class="mark"></span>IMO Factory</div>
    <nav>
      <a href="#ringkasan">Ringkasan</a><a href="#anggota">Anggota</a>
      <a href="#topik">Topik</a><a href="#waktu">Waktu</a><a href="#budaya">Budaya</a>
    </nav>
    <button class="btn" type="button" onclick="navigator.clipboard.writeText(location.href).then(()=>this.textContent='Tersalin')">Salin tautan</button>
  </div></header>
  <div class="wrap" id="app"></div>
  <script id="data" type="application/json">__DATA__</script>
  <script>
    const D = JSON.parse(document.getElementById("data").textContent);
    const idn = (n,d=0) => new Intl.NumberFormat("id-ID",{maximumFractionDigits:d,minimumFractionDigits:d}).format(n);
    const dlab = (iso) => new Date(iso+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
    const people = D.members.filter(m => !m.bot);
    const maxMsg = people[0].messages;
    const maxTopic = D.topics[0].messages;
    const roles = {mostActive:"Paling aktif",mostPresent:"Paling sering hadir",stickerKing:"Raja stiker",imageKing:"Raja gambar",mentionMagnet:"Paling di-tag",threadStarter:"Pembuka thread",nightOwl:"Night owl",longWriter:"Teks terpanjang",emojiKing:"Raja emoji"};
    const badges = (m) => Object.entries(D.roles).filter(([,v])=>v===m.name).map(([k])=>roles[k]).concat(m.alumni?["Alumni"]:[]);
    function area(monthly){
      const w=720,h=200,p=28,max=Math.max(...monthly.map(x=>x.count));
      const pts=monthly.map((x,i)=>[p+i*((w-2*p)/(monthly.length-1)), h-p-(x.count/max)*(h-2*p)]);
      const d=pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
      return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="220" preserveAspectRatio="none"><path d="${d} L${pts.at(-1)[0]},${h-p} L${pts[0][0]},${h-p} Z" fill="rgba(0,122,255,.18)"/><path d="${d}" fill="none" stroke="#007aff" stroke-width="2.2"/></svg>`;
    }
    function bars(items,key,labelKey,color){
      const max=Math.max(...items.map(x=>x[key]));
      return items.map(x=>`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${x[labelKey]}</span><span class="num mute">${idn(x[key])}</span></div><div class="bar" style="max-width:none"><i style="width:${(x[key]/max)*100}%;background:${color||'var(--blue)'}"></i></div></div>`).join("");
    }
    const heatMax=Math.max(...D.heatmap.map(c=>c.count),1);
    const days=["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
    let heat=`<div style="overflow:auto"><div class="heat"><div></div>${[...Array(24)].map((_,h)=>`<div class="mute" style="font-size:10px;text-align:center">${h%3===0?String(h).padStart(2,"0"):""}</div>`).join("")}`;
    days.forEach((day,dow)=>{
      heat+=`<div class="mute" style="font-size:12px;align-self:center">${day}</div>`;
      for(let h=0;h<24;h++){
        const n=(D.heatmap.find(c=>c.dow===dow&&c.hour===h)||{count:0}).count;
        const t=n/heatMax;
        heat+=`<div class="cell" title="${day} ${String(h).padStart(2,"0")}.00 · ${idn(n)}" style="background:${n===0?"var(--fill)":`rgba(0,122,255,${0.14+t*0.78})`}"></div>`;
      }
    });
    heat+=`</div></div>`;
    document.getElementById("app").innerHTML=`
      <p class="kicker" id="ringkasan">Analitik grup WhatsApp</p>
      <h1>Siapa yang paling ramai di IMO</h1>
      <p class="lead">${idn(D.totals.messages)} pesan dari ${dlab(D.meta.firstMessageAt)} sampai ${dlab(D.meta.lastMessageAt)}. Tanpa isi chat, tanpa nomor telepon, tanpa sandi rapat.</p>
      <div class="grid g4" style="margin-top:24px">
        <div class="card"><div class="stat-l">Pesan</div><div class="stat-v">${idn(D.totals.messages)}</div><div class="stat-h">${idn(D.totals.avgPerDay,1)} / hari kalender</div></div>
        <div class="card"><div class="stat-l">Anggota</div><div class="stat-v">${idn(D.totals.members)}</div><div class="stat-h">${idn(D.totals.activeDays)} hari ada obrolan</div></div>
        <div class="card"><div class="stat-l">Usia grup</div><div class="stat-v">${idn(D.meta.spanDays)} hari</div><div class="stat-h">${dlab(D.meta.firstMessageAt)} – ${dlab(D.meta.lastMessageAt)}</div></div>
        <div class="card"><div class="stat-l">Top 5 menulis</div><div class="stat-v">${String(D.totals.top5SharePct).replace(".",",")}%</div><div class="stat-h">Hermawan, Danti, Lucky, Tifta, Fajar</div></div>
      </div>
      <div class="grid g3" style="margin-top:12px">
        <div class="card"><div class="stat-l">Jam kantor 09–18</div><div class="stat-v">${idn(D.totals.officePct,0)}%</div></div>
        <div class="card"><div class="stat-l">Akhir pekan</div><div class="stat-v">${String(D.totals.weekendPct).replace(".",",")}%</div></div>
        <div class="card"><div class="stat-l">Stiker / gambar</div><div class="stat-v">${idn(D.totals.stickers)} / ${idn(D.totals.images)}</div></div>
      </div>
      <h2>Highlight</h2>
      <div class="grid g3">${D.highlights.map(h=>`<div class="card"><div class="stat-l" style="color:var(--blue)">${h.kicker}</div><h3 style="margin-top:8px">${h.title}</h3><p class="mute" style="margin:0;font-size:15px">${h.body}</p></div>`).join("")}</div>
      <h2 id="anggota">Peringkat anggota</h2>
      <p class="note">Diurutkan dari jumlah pesan. Meta AI tidak masuk ranking.</p>
      <div class="card" style="padding:8px 4px;overflow:auto">
        <table><thead><tr><th>#</th><th>Anggota</th><th>Pesan</th><th>Hari</th><th>Stiker</th><th>Gambar</th><th>Mention</th><th>Luar jam</th></tr></thead>
        <tbody>${people.map(m=>`<tr>
          <td><span class="rank ${m.rank<=3?"top":""}">${m.rank}</span></td>
          <td><strong>${m.name}</strong><div class="bar"><i style="width:${(m.messages/maxMsg)*100}%"></i></div>${badges(m).map(b=>`<span class="chip">${b}</span>`).join("")}</td>
          <td class="num">${idn(m.messages)} <span class="mute">${String(m.sharePct).replace(".",",")}%</span></td>
          <td class="num">${idn(m.activeDays)}</td><td class="num">${idn(m.stickers)}</td><td class="num">${idn(m.images)}</td>
          <td class="num">${idn(m.mentionsReceived)}</td><td class="num">${String(m.afterHoursPct).replace(".",",")}%</td>
        </tr>`).join("")}</tbody></table>
      </div>
      <h2>Peran di grup</h2>
      <div class="grid g3">${Object.entries(D.roles).map(([k,v])=>v?`<div class="card"><div class="stat-l">${roles[k]}</div><div style="margin-top:6px;font-weight:590">${v}</div></div>`:"").join("")}</div>
      <h2 id="topik">Topik yang dibahas</h2>
      <p class="note">Dari kata kunci di pesan teks, terhadap ${idn(D.totals.text)} pesan teks.</p>
      <div class="grid g2">
        <div class="card">${D.topics.map(t=>`<div style="margin:14px 0"><div style="display:flex;justify-content:space-between"><strong>${t.label}</strong><span class="num mute">${idn(t.messages)}</span></div><div class="mute" style="font-size:13px">${t.blurb}</div><div class="bar" style="max-width:none"><i style="width:${(t.messages/maxTopic)*100}%"></i></div></div>`).join("")}</div>
        <div class="card"><h3>Pergeseran per tahun</h3>
          <div style="overflow:auto"><table><thead><tr><th>Topik</th>${D.yearly.map(y=>`<th style="text-align:right">${y.year}</th>`).join("")}</tr></thead>
          <tbody>${D.topics.slice(0,8).map(t=>`<tr><td>${t.label}</td>${D.yearly.map(y=>`<td class="num" style="text-align:right">${idn(t.byYear[y.year]||0)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        </div>
      </div>
      <h2 id="waktu">Kapan grup ini hidup</h2>
      <p class="note">Puncak 2023. Selasa–Kamis tersibuk. Hampir tidak ada chat akhir pekan.</p>
      <div class="card"><h3>Pesan per bulan</h3>${area(D.monthly)}</div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3>Per tahun</h3>${bars(D.yearly,"count","year")}</div>
        <div class="card"><h3>Hari dalam seminggu</h3>${bars(D.weekdays,"count","day","var(--green)")}</div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Jam (WIB)</h3>${bars(D.hourly.map(x=>({...x,label:String(x.hour).padStart(2,"0")})),"count","label")}</div>
      <div class="card" style="margin-top:12px"><h3>Heatmap jam × hari</h3>${heat}<p class="mute" style="font-size:12px">Abu-abu = sepi · biru = ramai.</p></div>
      <h2 id="budaya">Budaya grup</h2>
      <div class="grid g2">
        <div class="card"><h3>Evolusi nama grup</h3><ol>${D.nameHistory.map(h=>`<li style="margin:10px 0"><strong>${h.name}</strong><div class="mute" style="font-size:13px">${dlab(h.at)} · ${h.by}</div></li>`).join("")}</ol></div>
        <div class="card"><h3>Panggilan</h3>${D.nicknames.map(n=>`<div class="row"><span><strong>“${n.nick}”</strong> <span class="mute">→ ${n.refersTo}</span></span><span class="num mute">${idn(n.count)}</span></div>`).join("")}
          <h3 style="margin-top:22px">Emoji</h3>${D.topEmojis.map(e=>`<span class="pill">${e.emoji} <span class="num mute">${idn(e.count)}</span></span>`).join("")}</div>
      </div>
      <div class="card" style="margin-top:12px"><h3>Kata yang sering muncul</h3>${D.topWords.map(w=>`<span class="pill">${w.word} <span class="num mute">${idn(w.count)}</span></span>`).join("")}</div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3>Jenis pesan</h3>${D.mix.map(m=>`<div class="row"><span>${m.kind}</span><span class="num">${idn(m.count)}</span></div>`).join("")}</div>
        <div class="card"><h3>Situs yang dibagikan</h3>${D.urlHosts.map(u=>`<div class="row"><span>${u.host}</span><span class="num">${idn(u.count)}</span></div>`).join("")}</div>
      </div>
      ${D.alumni.length?`<div class="card" style="margin-top:12px"><h3>Alumni</h3><div class="grid g3">${D.alumni.map(a=>`<div style="background:var(--fill);border-radius:14px;padding:12px"><strong>${a.name}</strong><div class="mute" style="font-size:13px">Terakhir ${dlab(a.lastAt)}</div></div>`).join("")}</div></div>`:""}
      <footer><p>${D.meta.privacyNote}</p><p>Sumber: ${D.meta.source} · ${dlab(D.meta.generatedAt)}</p><p>IMO Factory · 2026</p></footer>
    `;
  </script>
</body>
</html>
"""

payload = json.dumps(DATA, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
OUT.write_text(HTML.replace("__DATA__", payload), encoding="utf-8")
print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
