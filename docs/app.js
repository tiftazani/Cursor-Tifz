const PALETTE = ["#c44722", "#1b5648", "#243652", "#8d2c12", "#6b3f69", "#3d6b7a", "#b8893a", "#9c3b54"];

const ROLE_LABEL = {
  mostActive: "Paling ramai",
  mostPresent: "Paling sering hadir",
  stickerKing: "Raja stiker",
  imageKing: "Raja gambar",
  mentionMagnet: "Paling di-tag",
  threadStarter: "Pembuka thread",
  nightOwl: "Night owl",
  longWriter: "Teks terpanjang",
  emojiKing: "Raja emoji",
};

const idn = (n, d = 0) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

const dlab = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function hash(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function colorFor(name) {
  return PALETTE[hash(name) % PALETTE.length];
}

function portrait(name, size = 72) {
  const h = hash(name);
  const c1 = PALETTE[h % PALETTE.length];
  const c2 = PALETTE[(h >> 3) % PALETTE.length];
  const c3 = PALETTE[(h >> 6) % PALETTE.length];
  const rot = h % 360;
  const initials = name
    .replace(/[()·]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return `<svg class="portrait avatar" viewBox="0 0 72 72" width="${size}" height="${size}" aria-hidden="true">
    <rect width="72" height="72" rx="18" fill="${c1}"/>
    <circle cx="${22 + (h % 18)}" cy="${20 + ((h >> 2) % 16)}" r="${14 + (h % 10)}" fill="${c2}" opacity="0.55"/>
    <rect x="8" y="${40 + (h % 8)}" width="${48 + (h % 12)}" height="18" rx="9" fill="${c3}" opacity="0.45" transform="rotate(${rot / 18} 36 36)"/>
    <text x="36" y="42" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="20" font-weight="600" fill="#fffaf2">${initials}</text>
  </svg>`;
}

function badges(member, roles) {
  const out = [];
  for (const [k, label] of Object.entries(ROLE_LABEL)) {
    if (roles[k] === member.name) out.push(label);
  }
  if (member.alumni) out.push("Alumni");
  return out;
}

function countUp(el, to, duration = 1100) {
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = idn(Math.round(to * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function radialClock(hourly, officePct, size = 200) {
  const max = Math.max(...hourly.map((h) => h.count), 1);
  let rings = "";
  hourly.forEach((h) => {
    const a0 = (h.hour / 24) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((h.hour + 1) / 24) * Math.PI * 2 - Math.PI / 2;
    const r0 = 52;
    const r1 = 52 + 36 * (h.count / max);
    const x0 = 100 + Math.cos(a0) * r0;
    const y0 = 100 + Math.sin(a0) * r0;
    const x1 = 100 + Math.cos(a1) * r0;
    const y1 = 100 + Math.sin(a1) * r0;
    const x2 = 100 + Math.cos(a1) * r1;
    const y2 = 100 + Math.sin(a1) * r1;
    const x3 = 100 + Math.cos(a0) * r1;
    const y3 = 100 + Math.sin(a0) * r1;
    const fill = h.hour >= 9 && h.hour < 18 ? "#1b5648" : "#c44722";
    const op = 0.22 + 0.78 * (h.count / max);
    rings += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r0} ${r0} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r1.toFixed(1)} ${r1.toFixed(1)} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z" fill="${fill}" opacity="${op.toFixed(2)}"/>`;
  });
  const pct = String(officePct).replace(".", ",");
  return `<svg class="clock" viewBox="0 0 ${size} ${size}" width="100%">
    ${rings}
    <circle cx="100" cy="100" r="44" fill="#fffaf2"/>
    <text x="100" y="94" text-anchor="middle" font-size="10" fill="#746b60" font-family="Plus Jakarta Sans, sans-serif">09–18</text>
    <text x="100" y="114" text-anchor="middle" font-size="18" font-weight="700" fill="#171310" font-family="Fraunces, serif">${pct}%</text>
  </svg>`;
}

function monthlyChart(el, monthly) {
  const w = 720;
  const h = 220;
  const p = 28;
  const max = Math.max(...monthly.map((m) => m.count), 1);
  const pts = monthly.map((m, i) => {
    const x = p + (i * (w - 2 * p)) / Math.max(monthly.length - 1, 1);
    const y = h - p - (m.count / max) * (h - 2 * p);
    return [x, y];
  });
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ");
  const fill = `${d} L${pts.at(-1)[0]},${h - p} L${pts[0][0]},${h - p} Z`;
  const peak = monthly.reduce((a, b) => (b.count > a.count ? b : a));
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="220" preserveAspectRatio="none" aria-label="Pesan per bulan">
    <path d="${fill}" fill="rgba(196,71,34,.14)"/>
    <path d="${d}" fill="none" stroke="#c44722" stroke-width="2.6" stroke-linejoin="round"/>
  </svg>
  <p class="hint">Puncak ${peak.month || peak.label || ""} · ${idn(peak.count)} pesan</p>`;
}

function bars(el, items, key, labelKey) {
  const max = Math.max(...items.map((x) => x[key]), 1);
  const peak = Math.max(...items.map((x) => x[key]));
  el.classList.add("bars");
  el.innerHTML = items
    .map((x) => {
      const v = x[key];
      return `<div class="item ${v === peak ? "is-peak" : ""}">
        <span>${x[labelKey]}</span>
        <div><i style="width:${(v / max) * 100}%"></i></div>
        <b>${idn(v)}</b>
      </div>`;
    })
    .join("");
}

function heat(el, cells) {
  const max = Math.max(...cells.map((c) => c.count), 1);
  const days = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const map = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c.count]));
  let html = `<div class="heat"><div></div>${Array.from({ length: 24 }, (_, hour) => `<div style="font-size:10px;color:#746b60;text-align:center">${hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}</div>`).join("")}`;
  days.forEach((day, dow) => {
    html += `<div style="font-size:12px;color:#746b60;align-self:center">${day}</div>`;
    for (let hour = 0; hour < 24; hour++) {
      const n = map.get(`${dow}-${hour}`) || 0;
      const t = n / max;
      const bg = n === 0 ? "#ece3d2" : `rgba(196, 71, 34, ${(0.16 + t * 0.84).toFixed(2)})`;
      html += `<div class="cell" title="${day} ${String(hour).padStart(2, "0")}.00 · ${idn(n)}" style="background:${bg}"></div>`;
    }
  });
  el.innerHTML = `${html}</div>`;
}

function sparkline(byYear) {
  const years = Object.keys(byYear).sort();
  const vals = years.map((y) => byYear[y]);
  const max = Math.max(...vals, 1);
  const w = 280;
  const h = 72;
  const pts = vals.map((v, i) => {
    const x = 8 + (i * (w - 16)) / Math.max(vals.length - 1, 1);
    const y = h - 12 - (v / max) * (h - 24);
    return [x, y];
  });
  const d = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ");
  const labels = years
    .map((y, i) => `<text x="${pts[i][0].toFixed(1)}" y="${h - 2}" text-anchor="middle" font-size="9" fill="#746b60">${y.slice(2)}</text>`)
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="72">${labels}<path d="${d}" fill="none" stroke="#1b5648" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}

function renderDossier(el, member, roles) {
  const chips = badges(member, roles)
    .map((b) => `<span class="chip">${b}</span>`)
    .join("");
  el.innerHTML = `
    <div class="file-top">
      ${portrait(member.name, 64)}
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#746b60">Peringkat ${member.rank}</div>
        <h3>${member.name}</h3>
      </div>
    </div>
    <div class="chips">${chips || `<span class="chip">Anggota</span>`}</div>
    <div class="facts">
      <div><span>Pesan</span><b>${idn(member.messages)}</b></div>
      <div><span>Porsi</span><b>${String(member.sharePct).replace(".", ",")}%</b></div>
      <div><span>Hari hadir</span><b>${idn(member.activeDays)}</b></div>
      <div><span>Jam puncak</span><b>${String(member.peakHour).padStart(2, "0")}.00</b></div>
      <div><span>Stiker</span><b>${idn(member.stickers)}</b></div>
      <div><span>Gambar</span><b>${idn(member.images)}</b></div>
    </div>
    <div class="spark">${sparkline(member.byYear)}</div>
    <p class="hint" style="text-align:left">Pertama ${dlab(member.firstAt)} · terakhir ${dlab(member.lastAt)}${member.alumni ? " · sudah sepi >6 bulan" : ""}</p>
  `;
}

async function main() {
  const D = await fetch("./data.json").then((r) => {
    if (!r.ok) throw new Error("data.json tidak ketemu");
    return r.json();
  });
  const people = D.members.filter((m) => !m.bot);
  const maxMsg = people[0].messages;

  countUp(document.getElementById("hero-count"), D.totals.messages, 1400);
  document.getElementById("hero-clock").outerHTML = radialClock(D.hourly, D.totals.officePct);

  document.getElementById("stats").innerHTML = [
    ["Pesan", idn(D.totals.messages), `${idn(D.totals.avgPerDay, 1)} / hari kalender`],
    ["Anggota", idn(D.totals.members), `${idn(D.totals.activeDays)} hari hidup`],
    ["Usia", `${idn(D.meta.spanDays)} hari`, `${dlab(D.meta.firstMessageAt)} – ${dlab(D.meta.lastMessageAt)}`],
    ["Top 5", `${String(D.totals.top5SharePct).replace(".", ",")}%`, "dari seluruh pesan"],
  ]
    .map(([l, v, h]) => `<article><span>${l}</span><strong>${v}</strong><small>${h}</small></article>`)
    .join("");

  document.getElementById("pentarchy").innerHTML = people
    .slice(0, 5)
    .map(
      (m) => `<article class="penta ${m.rank === 1 ? "is-1" : ""}">
        <div class="wm">${m.rank}</div>
        ${portrait(m.name)}
        <h3>${m.name}</h3>
        <div class="n">${idn(m.messages)} pesan · ${idn(m.activeDays)} hari</div>
        <div class="share"><i style="width:${(m.messages / maxMsg) * 100}%"></i></div>
        <div class="pct">${String(m.sharePct).replace(".", ",")}%</div>
      </article>`,
    )
    .join("");

  const roster = document.getElementById("roster");
  const dossier = document.getElementById("dossier");
  roster.innerHTML = people
    .map(
      (m, i) => `<button class="row ${i === 0 ? "is-on" : ""}" type="button" role="option" aria-selected="${i === 0}" data-i="${i}">
        <div class="rank">${m.rank}</div>
        ${portrait(m.name, 44)}
        <div>
          <div class="who">${m.name}</div>
          <div class="bar"><i style="width:${(m.messages / maxMsg) * 100}%"></i></div>
        </div>
        <div class="meta"><b>${idn(m.messages)}</b><span>${idn(m.stickers)} stiker</span></div>
      </button>`,
    )
    .join("");

  renderDossier(dossier, people[0], D.roles);
  roster.addEventListener("click", (e) => {
    const btn = e.target.closest(".row");
    if (!btn) return;
    roster.querySelectorAll(".row").forEach((r) => {
      r.classList.toggle("is-on", r === btn);
      r.setAttribute("aria-selected", r === btn ? "true" : "false");
    });
    renderDossier(dossier, people[Number(btn.dataset.i)], D.roles);
    if (window.matchMedia("(max-width: 979px)").matches) {
      dossier.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  document.getElementById("roles").innerHTML = Object.entries(D.roles)
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="role"><span>${ROLE_LABEL[k]}</span><b>${v}</b></div>`)
    .join("");

  const tmax = D.topics[0].messages;
  document.getElementById("topics").innerHTML = D.topics
    .map(
      (t) => `<div class="topic ${t.id === "kpi" ? "hot" : ""}">
        <div><b>${t.label}</b><div class="blurb">${t.blurb}</div></div>
        <div class="tbar"><i style="width:${(t.messages / tmax) * 100}%"></i></div>
        <small>${idn(t.messages)}</small>
      </div>`,
    )
    .join("");

  monthlyChart(document.getElementById("monthly"), D.monthly);
  bars(document.getElementById("yearly"), D.yearly, "count", "year");
  bars(document.getElementById("week"), D.weekdays, "count", "day");
  document.getElementById("clock").innerHTML = radialClock(D.hourly, D.totals.officePct);
  heat(document.getElementById("heat"), D.heatmap);

  document.getElementById("names").innerHTML = D.nameHistory
    .map(
      (h) =>
        `<li><span class="dot"></span><div><b>${h.name}</b><div style="color:#746b60;font-size:13px">${dlab(h.at)} · ${h.by}</div></div></li>`,
    )
    .join("");

  document.getElementById("nicks").innerHTML = D.nicknames
    .map((n) => `<span class="pill"><b>“${n.nick}”</b> → ${n.refersTo} · ${idn(n.count)}</span>`)
    .join("");
  document.getElementById("words").innerHTML = D.topWords
    .slice(0, 24)
    .map((w) => `<span class="pill">${w.word} <span style="color:#746b60">${idn(w.count)}</span></span>`)
    .join("");

  document.getElementById("privacy").textContent = D.meta.privacyNote;

  document.getElementById("copy").onclick = async () => {
    await navigator.clipboard.writeText(location.href);
    document.getElementById("copy").textContent = "Tersalin";
    setTimeout(() => {
      document.getElementById("copy").textContent = "Salin tautan";
    }, 1600);
  };
}

main().catch((err) => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p style="padding:24px;font-family:sans-serif">Gagal memuat data: ${err.message}</p>`,
  );
});
