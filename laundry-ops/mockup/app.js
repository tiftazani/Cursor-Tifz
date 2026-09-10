const Rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const AUTH = ["login", "register", "pending", "rejected"];

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1z"/></svg>`,
  kasir: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M4 19a5 5 0 0 1 10 0"/><circle cx="17" cy="9" r="2"/><path d="M20 19a4 4 0 0 0-4-4"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8 12 4l9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>`,
};

const LAUNDRY = [
  { id: "masuk", label: "Laundry Masuk", next: "progress" },
  { id: "progress", label: "Laundry In Progress", next: "selesai" },
  { id: "selesai", label: "Laundry Selesai", next: null },
];

const SVC_ICON = {
  cuci: { bg: "#dbeafe", svg: `<svg viewBox="0 0 32 32" fill="none"><path d="M10 12l6-6 6 6v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V12z" fill="#60a5fa"/><path d="M8 14h16" stroke="#1d4ed8" stroke-width="1.6"/></svg>` },
  curing: { bg: "#e0e7ff", svg: `<svg viewBox="0 0 32 32" fill="none"><path d="M16 6v4M10 14h12l-1 12H11L10 14z" stroke="#6366f1" stroke-width="1.8" fill="#c7d2fe"/><circle cx="16" cy="8" r="2" fill="#6366f1"/></svg>` },
  do: { bg: "#fce7f3", svg: `<svg viewBox="0 0 32 32" fill="none"><path d="M8 12h16l-2 14H10L8 12z" fill="#f9a8d4" stroke="#db2777" stroke-width="1.5"/><path d="M12 12V9a4 4 0 0 1 8 0v3" stroke="#db2777" stroke-width="1.6"/></svg>` },
  "do-lipat": { bg: "#fae8ff", svg: `<svg viewBox="0 0 32 32" fill="none"><rect x="7" y="10" width="18" height="14" rx="2" fill="#e879f9"/><path d="M7 17h18M16 10v14" stroke="#fff" stroke-width="1.4"/></svg>` },
  sabun: { bg: "#d1fae5", svg: `<svg viewBox="0 0 32 32" fill="none"><rect x="8" y="12" width="16" height="12" rx="6" fill="#34d399"/><circle cx="20" cy="10" r="3" fill="#6ee7b7"/></svg>` },
  softener: { bg: "#ccfbf1", svg: `<svg viewBox="0 0 32 32" fill="none"><path d="M12 8h8l2 4v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V12l2-4z" fill="#2dd4bf"/><path d="M12 12h8" stroke="#0f766e" stroke-width="1.4"/></svg>` },
  parfum: { bg: "#fef3c7", svg: `<svg viewBox="0 0 32 32" fill="none"><rect x="12" y="12" width="8" height="14" rx="2" fill="#fbbf24"/><path d="M14 12V8h4v4M16 6v2" stroke="#d97706" stroke-width="1.6"/><circle cx="22" cy="9" r="1.5" fill="#f59e0b"/></svg>` },
};

const SERVICES = [
  { id: "cuci", name: "Cuci", desc: "Cuci reguler, kering di tempat", unit: "kg", price: 7000, dropOut: false, retail: false },
  { id: "curing", name: "Cuci kering (Curing)", desc: "Curing, tidak basah pulang", unit: "kg", price: 9000, dropOut: false, retail: false },
  { id: "do", name: "Curing DO", desc: "Drop Out — tidak perlu nunggu", unit: "kg", price: 10000, dropOut: true, retail: false },
  { id: "do-lipat", name: "Curing DO Lipat", desc: "Drop Out + dilipat rapi", unit: "kg", price: 12000, dropOut: true, retail: false },
  { id: "sabun", name: "Sabun", desc: "Retail, potong stok", unit: "pcs", price: 8000, dropOut: false, retail: true },
  { id: "softener", name: "Softener", desc: "Retail, potong stok", unit: "pcs", price: 10000, dropOut: false, retail: true },
  { id: "parfum", name: "Parfum uk 100", desc: "Retail 100ml, potong stok", unit: "pcs", price: 15000, dropOut: false, retail: true },
];

const BRANCHES = [
  { id: "melati", code: "MEL", name: "Cuciin Melati", location: "Jl. Melati 12, Bandung", maps: "https://maps.google.com/?q=-6.9175,107.6191", mapsLabel: "-6.9175, 107.6191" },
  { id: "cibaduyut", code: "CIB", name: "Cuciin Cibaduyut", location: "Jl. Cibaduyut Raya 88, Bandung", maps: "https://maps.google.com/?q=-6.9590,107.5920", mapsLabel: "-6.9590, 107.5920" },
];

const CUSTOMERS = [
  { id: "c1", name: "Siti Rahma", address: "Jl. Melati 12, Bandung", phone: "0812-3301-8890", initials: "SR", due: 0 },
  { id: "c2", name: "Budi Santoso", address: "Komplek Cempaka Blok B2", phone: "0857-1120-4455", initials: "BS", due: 34000 },
  { id: "c3", name: "Dewi Lestari", address: "Jl. Anggrek No. 8", phone: "0813-7788-2210", initials: "DL", due: 28000 },
];

const MODULES = [
  { id: "dashboard", label: "Antrian" },
  { id: "pelanggan", label: "Pelanggan" },
  { id: "transaksi", label: "Nota" },
  { id: "wa", label: "WA nota" },
  { id: "layanan", label: "Layanan" },
  { id: "inventory", label: "Stok" },
  { id: "kas", label: "Tutup kas" },
  { id: "cabang", label: "Cabang" },
  { id: "user", label: "User" },
  { id: "role", label: "Role & akses" },
  { id: "audit", label: "Audit trail" },
  { id: "laporan", label: "Analytics" },
  { id: "profil", label: "Profil" },
];

const state = {
  role: "owner",
  screen: "login",
  history: [],
  loggedIn: false,
  customer: CUSTOMERS[0],
  cart: [],
  sheet: null,
  qtyDraft: 1,
  paid: 0,
  payMethod: "tunai",
  promise: "Hari ini, 17.00",
  toast: "",
  waSent: false,
  waKind: "nota",
  payTarget: null,
  extraPay: 0,
  userFilter: "pengajuan",
  ownerName: "Tiftazani Khara",
  ownerEmail: "tiftazani.khara@gmail.com",
  reportPeriod: "minggu",
  viewBranch: "melati",
  viewKasir: "all",
  queueFilter: "gantung",
  waList: "pending",
  stockPeriod: "7hari",
  stockEditKind: "tambah",
  activeQueueId: "MEL-2409-0042",
  searchQ: "",
  actor: "Rina",
  roles: [
    { name: "Owner", modules: MODULES.map((m) => m.id), owner: true },
    { name: "Kasir", modules: ["dashboard", "pelanggan", "transaksi", "wa", "inventory", "kas"] },
    { name: "Supervisor", modules: ["dashboard", "inventory"] },
    { name: "Operator Mesin", modules: ["dashboard"] },
  ],
  users: [
    { name: "Tiftazani Khara", role: "Owner", status: "approved", branches: ["melati", "cibaduyut"] },
    { name: "Rina", role: "Kasir", status: "approved", branches: ["melati"] },
    { name: "Dedi", role: "Kasir", status: "approved", branches: ["melati"] },
    { name: "Andi", role: "Supervisor", status: "approved", branches: ["melati"] },
    { name: "Salsa", role: "Kasir", status: "approved", branches: ["cibaduyut"] },
    { name: "Yoga", role: "Supervisor", status: "approved", branches: ["cibaduyut"] },
    { name: "Fajar Putra", role: "Kasir", status: "pending", branches: ["melati"] },
  ],
  products: [
    { name: "Sabun", stock: 24, min: 8 },
    { name: "Softener", stock: 18, min: 6 },
    { name: "Parfum uk 100", stock: 9, min: 5 },
  ],
  stockMoves: [
    { at: "03 Sep 08.40", product: "Sabun", kind: "tambah", qty: 20, by: "Rina", branch: "melati", note: "Manual restock" },
    { at: "05 Sep 11.02", product: "Sabun", kind: "jual", qty: -2, by: "Rina", branch: "melati", nota: "MEL-2409-0038" },
    { at: "08 Sep 09.15", product: "Softener", kind: "update", qty: 18, by: "Dedi", branch: "melati", note: "Hitung ulang rak" },
    { at: "09 Sep 16.20", product: "Parfum uk 100", kind: "kurang", qty: -1, by: "Rina", branch: "melati", note: "Rusak" },
    { at: "10 Sep 09.22", product: "Sabun", kind: "jual", qty: -1, by: "Rina", branch: "melati", nota: "MEL-2409-0042" },
  ],
  queue: [
    { id: "MEL-2409-0042", branch: "melati", kasir: "Rina", customer: "Siti Rahma", phone: "0812-3301-8890", items: "Curing DO 3 kg + Sabun 1", total: 38000, paid: 38000, pay: "lunas", laundry: "progress", dropOut: true, promise: "Hari ini 17.00", createdAt: "10 Sep 2026, 09.12", pickupAt: "10 Sep 2026, 17.00", waSent: false, photos: [{ name: "nota-siti.jpg" }], late: false },
    { id: "MEL-2409-0041", branch: "melati", kasir: "Dedi", customer: "Budi Santoso", phone: "0857-1120-4455", items: "Cuci 5 kg", total: 54000, paid: 20000, pay: "belum", laundry: "selesai", dropOut: false, promise: "Kemarin 16.00", createdAt: "09 Sep 2026, 14.03", pickupAt: "09 Sep 2026, 16.00", waSent: true, waAt: "09 Sep 2026, 14.08", photos: [], late: true },
    { id: "MEL-2409-0040", branch: "melati", kasir: "Rina", customer: "Dewi Lestari", phone: "0813-7788-2210", items: "Curing DO Lipat 2 kg", total: 28000, paid: 0, pay: "belum", laundry: "masuk", dropOut: true, promise: "Hari ini 18.00", createdAt: "10 Sep 2026, 08.41", pickupAt: "10 Sep 2026, 18.00", waSent: false, photos: [], late: false },
    { id: "CIB-2409-0018", branch: "cibaduyut", kasir: "Salsa", customer: "Agus Wijaya", phone: "0812-9000-1122", items: "Cuci 4 kg", total: 28000, paid: 28000, pay: "lunas", laundry: "selesai", dropOut: false, promise: "Hari ini 15.00", createdAt: "10 Sep 2026, 07.55", pickupAt: "10 Sep 2026, 15.00", waSent: true, waAt: "10 Sep 2026, 08.01", photos: [{ name: "bukti-transfer.jpg" }], late: false },
  ],
  audit: [
    { at: "10 Sep 09.22", user: "Rina", branch: "melati", action: "Nota MEL-2409-0042 disimpan · Tunai lunas", nota: "MEL-2409-0042" },
    { at: "10 Sep 09.22", user: "Rina", branch: "melati", action: "Stok Sabun −1 (jual via nota)", nota: "MEL-2409-0042" },
    { at: "10 Sep 08.41", user: "Rina", branch: "melati", action: "Nota MEL-2409-0040 masuk · Belum lunas", nota: "MEL-2409-0040" },
    { at: "10 Sep 08.01", user: "Salsa", branch: "cibaduyut", action: "WA nota CIB-2409-0018 terkirim", nota: "CIB-2409-0018" },
    { at: "09 Sep 16.40", user: "Dedi", branch: "melati", action: "Laundry MEL-2409-0041 → Selesai, bayar masih Belum lunas", nota: "MEL-2409-0041" },
  ],
};

const TABS = {
  owner: [
    { id: "home", label: "Antrian", icon: "home" },
    { id: "analytics", label: "Data", icon: "kasir" },
    { id: "customers", label: "Pelanggan", icon: "people" },
    { id: "inventory", label: "Stok", icon: "box" },
    { id: "more", label: "Modul", icon: "more" },
  ],
  kasir: [
    { id: "home", label: "Antrian", icon: "home" },
    { id: "kasir", label: "Nota", icon: "kasir" },
    { id: "wa-outbox", label: "WA", icon: "people" },
    { id: "inventory", label: "Stok", icon: "box" },
  ],
  supervisor: [{ id: "home", label: "Antrian", icon: "home" }],
};

const JUMPS = [
  { id: "login", label: "Login" },
  { id: "register", label: "Daftar" },
  { id: "home", label: "Antrian" },
  { id: "kasir", label: "Nota baru" },
  { id: "nota", label: "Kirim nota" },
  { id: "wa-outbox", label: "WA pending" },
  { id: "wa-archive", label: "WA archive" },
  { id: "queue-detail", label: "Detail antrian" },
  { id: "branches", label: "Cabang" },
  { id: "analytics", label: "Analytics Owner" },
  { id: "inventory", label: "Stok" },
  { id: "stok-history", label: "Mutasi stok" },
  { id: "audit", label: "Audit trail" },
  { id: "modules", label: "Modul" },
];

function branchOf(id) {
  return BRANCHES.find((b) => b.id === (id || state.viewBranch)) || BRANCHES[0];
}

function currentBranch() {
  if (state.role === "owner") return branchOf(state.viewBranch);
  if (state.role === "kasir") return branchOf(state.actor === "Salsa" ? "cibaduyut" : "melati");
  return branchOf("melati");
}

function currentActor() {
  if (state.role === "owner") return state.ownerName;
  if (state.role === "supervisor") return "Andi";
  return state.actor;
}

function laundryMeta(id) {
  return LAUNDRY.find((p) => p.id === id) || LAUNDRY[0];
}

function hanging(o) {
  return o.laundry !== "selesai" || o.pay !== "lunas";
}

function payChip(o) {
  return o.pay === "lunas" ? { id: "lunas", label: "Lunas" } : { id: "belum", label: "Belum lunas" };
}

function visibleQueue() {
  const b = currentBranch().id;
  let rows = state.queue;
  if (state.role !== "owner") rows = rows.filter((q) => q.branch === b);
  else if (state.viewBranch !== "all") rows = rows.filter((q) => q.branch === state.viewBranch);
  if (state.role === "owner" && state.viewKasir !== "all") rows = rows.filter((q) => q.kasir === state.viewKasir);
  return rows;
}

function cartTotal() {
  return state.cart.reduce((s, i) => s + i.qty * i.price, 0);
}

function waNumber(phone) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) return "62" + d.slice(1);
  return d;
}

function methodLabel() {
  return { tunai: "Tunai", qris: "QRIS", transfer: "Transfer" }[state.payMethod] || "Tunai";
}

function nextNotaId(branchId) {
  const b = branchOf(branchId);
  const n = state.queue.filter((q) => q.branch === b.id).length + 43;
  return `${b.code}-2409-${String(n).padStart(4, "0")}`;
}

function pushAudit(action, nota) {
  state.audit.unshift({
    at: "10 Sep 09.41",
    user: currentActor(),
    branch: currentBranch().id,
    action,
    nota: nota || "",
  });
}

function notaText(order) {
  const o = order || {
    id: nextNotaId(currentBranch().id),
    customer: state.customer.name,
    phone: state.customer.phone,
    address: state.customer.address,
    items: (state.cart.length ? state.cart : [{ name: "Curing DO", qty: 3, unit: "kg", price: 10000 }])
      .map((i) => `${i.name} ${i.qty} ${i.unit}`)
      .join(", "),
    total: cartTotal() || 30000,
    paid: state.paid,
    pay: state.paid >= (cartTotal() || 30000) ? "lunas" : "belum",
    promise: state.promise,
    pickupAt: state.promise,
    createdAt: "10 Sep 2026, 09.41",
    kasir: currentActor(),
    branch: currentBranch().id,
  };
  const b = branchOf(o.branch);
  const lines = o.items;
  const pay = o.pay === "lunas" ? "Lunas" : "Belum lunas";
  return `Cuciin — Nota ${o.id}
Cabang  ${b.name}
Lokasi  ${b.location}
Maps    ${b.mapsLabel}
Kasir   ${o.kasir}
Waktu   ${o.createdAt}

${o.customer}
${o.address || ""}
WA ${o.phone}

${lines}

Total     ${Rp(o.total)}
Dibayar   ${Rp(o.paid)}
Bayar     ${pay}
Laundry   ${laundryMeta(o.laundry || "masuk").label}
Selesai / pickup  ${o.pickupAt || o.promise}`;
}

function siapText(order) {
  const o = order || activeQueue();
  const b = branchOf(o.branch);
  return `Cuciin — cucian siap diambil
Hai ${o.customer}, nota ${o.id} sudah ${laundryMeta(o.laundry).label}.
${o.items}
Ambil di ${b.name}, ${b.location}.
Pickup ${o.pickupAt}.`;
}

function personInitials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function activeQueue() {
  return state.queue.find((q) => q.id === state.activeQueueId) || visibleQueue()[0] || state.queue[0];
}

function registerRoles() {
  return state.roles.filter((r) => !r.owner);
}

function go(screen, opts = {}) {
  if (!opts.replace && state.screen !== screen) state.history.push(state.screen);
  if (opts.reset) state.history = [];
  state.screen = screen;
  state.loggedIn = !AUTH.includes(screen);
  render();
}

function goBack() {
  const prev = state.history.pop();
  if (prev) {
    state.screen = prev;
    state.loggedIn = !AUTH.includes(prev);
    render();
    return;
  }
  go(state.loggedIn ? "home" : "login", { replace: true });
}

function syncUrl() {
  const u = new URL(location.href);
  u.searchParams.set("role", state.role);
  u.searchParams.set("screen", state.screen);
  if (document.body.classList.contains("film")) u.searchParams.set("film", "1");
  history.replaceState(null, "", u.pathname + u.search);
}

function applyUrl() {
  const u = new URL(location.href);
  const role = u.searchParams.get("role");
  const screen = u.searchParams.get("screen");
  if (role && TABS[role]) {
    state.role = role;
    [...document.getElementById("role-switch").children].forEach((b) =>
      b.classList.toggle("on", b.dataset.role === role)
    );
  }
  if (u.searchParams.get("film") === "1") document.body.classList.add("film");
  if (screen && SCREENS[screen]) {
    state.screen = screen;
    state.loggedIn = !AUTH.includes(screen);
  }
  if (["bayar", "nota", "wa-chat"].includes(state.screen) && !state.cart.length) {
    state.cart = [{ ...SERVICES[2], qty: 3 }];
    state.paid = state.screen === "bayar" ? 0 : 30000;
  }
}

function showToast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 1800);
}

function navAllowed(id) {
  if (AUTH.includes(id)) return true;
  if (state.role === "owner") return true;
  if (state.role === "kasir") {
    return ["home", "kasir", "customers", "customer-form", "bayar", "nota", "wa-chat", "wa-ready", "wa-outbox", "wa-archive", "orders", "pelunasan", "inventory", "stok-masuk", "stok-edit", "stok-history", "tutup-kas", "queue-detail", "audit"].includes(id);
  }
  if (state.role === "supervisor") {
    return ["home", "queue-detail", "wa-ready", "inventory", "stok-history"].includes(id);
  }
  return false;
}

function backBtn(to) {
  if (to) return `<button class="icon-btn" data-go="${to}" aria-label="Kembali">←</button>`;
  return `<button class="icon-btn" data-back aria-label="Kembali">←</button>`;
}

function chipStatus(id, label) {
  return `<span class="chip ${id}">${label}</span>`;
}

function svcTile(s) {
  const ico = SVC_ICON[s.id] || SVC_ICON.cuci;
  return `<button class="svc" data-open-qty="${s.id}">
    <div class="svc-ico" style="background:${ico.bg}">${ico.svg}</div>
    <div>
      <div class="t">${s.name}</div>
      <div class="d">${s.desc}</div>
      <div class="p">${Rp(s.price)} / ${s.unit} ${s.dropOut ? '<span class="chip do">DO</span>' : ""}</div>
    </div>
  </button>`;
}

function authTabs(active) {
  return `<div class="auth-tabs">
    <button class="${active === "login" ? "on" : ""}" data-go="login">Masuk</button>
    <button class="${active === "register" ? "on" : ""}" data-go="register">Daftar</button>
  </div>`;
}

function stepper(current) {
  return `<div class="steps">${LAUNDRY.map((p) => {
    const idx = LAUNDRY.findIndex((x) => x.id === current);
    const i = LAUNDRY.findIndex((x) => x.id === p.id);
    const cls = i < idx ? "done" : i === idx ? "on" : "";
    return `<span class="${cls}">${p.label}</span>`;
  }).join("")}</div>`;
}

function branchPicker() {
  if (state.role !== "owner") return "";
  return `<div class="segment tight wrap">
    <button class="${state.viewBranch === "all" ? "on" : ""}" data-branch="all">Semua cabang</button>
    ${BRANCHES.map((b) => `<button class="${state.viewBranch === b.id ? "on" : ""}" data-branch="${b.id}">${b.name.replace("Cuciin ", "")}</button>`).join("")}
  </div>`;
}

function kasirPicker() {
  if (state.role !== "owner") return "";
  const kasirs = state.users.filter((u) => u.role === "Kasir" && u.status === "approved" && (state.viewBranch === "all" || u.branches.includes(state.viewBranch)));
  return `<div class="segment tight wrap">
    <button class="${state.viewKasir === "all" ? "on" : ""}" data-kasir="all">Semua kasir</button>
    ${kasirs.map((k) => `<button class="${state.viewKasir === k.name ? "on" : ""}" data-kasir="${k.name}">${k.name}</button>`).join("")}
  </div>`;
}

function queueCard(o) {
  const pay = payChip(o);
  const hang = hanging(o);
  const b = branchOf(o.branch);
  return `<button class="card tap ${hang ? "hang" : ""}" data-open-queue="${o.id}">
    <div class="row">
      <div class="grow">
        <div class="name">${o.id} · ${o.customer}</div>
        <div class="meta">${b.name.replace("Cuciin ", "")} · ${o.kasir} · ${o.items}</div>
        <div class="meta">Pickup ${o.pickupAt}</div>
      </div>
    </div>
    <div class="chip-row">
      ${chipStatus(pay.id, pay.label)}
      ${chipStatus(o.laundry, laundryMeta(o.laundry).label)}
      ${hang ? '<span class="chip belum">Menggantung</span>' : '<span class="chip lunas">Selesai keduanya</span>'}
      ${o.dropOut ? '<span class="chip do">Drop Out</span>' : ""}
      ${o.waSent ? '<span class="chip pipe">WA terkirim</span>' : '<span class="chip belum">WA pending</span>'}
    </div>
  </button>`;
}

function screenLogin() {
  return `<div class="login">
    <div class="mark">Ci</div>
    <h1>Cuciin</h1>
    <p class="lede">Owner: ${state.ownerName}. Kasir/SPV daftar per cabang.</p>
    ${authTabs("login")}
    <p class="hint">Akun awal belum punya kata sandi. Kolom itu boleh kosong.</p>
    <button class="btn primary" data-go="home">Masuk tanpa kata sandi</button>
    <label class="form"><span>Email</span><input value="${state.role === "owner" ? state.ownerEmail : "rina@cuciin.id"}" /></label>
    <label class="form"><span>Kata sandi — boleh dikosongkan</span><input type="password" value="" placeholder="boleh kosong" /></label>
    <button class="btn ghost" data-go="home">Masuk</button>
  </div>`;
}

function screenRegister() {
  const roles = registerRoles();
  return `<div class="login">
    ${backBtn("login")}
    <div class="mark">Ci</div>
    <h1>Daftar</h1>
    <p class="lede">Pilih role + cabang. Owner yang approve.</p>
    ${authTabs("register")}
    <label class="form"><span>Nama</span><input value="Fajar Putra" /></label>
    <label class="form"><span>Email</span><input value="fajar@cuciin.id" /></label>
    <label class="form"><span>Password</span><input type="password" value="••••••••" /></label>
    <label class="form"><span>Daftar sebagai</span>
      <select id="reg-role">${roles.map((r) => `<option ${r.name === "Kasir" ? "selected" : ""}>${r.name}</option>`).join("")}</select>
    </label>
    <label class="form"><span>Cabang laundry</span>
      <select id="reg-branch">${BRANCHES.map((b) => `<option value="${b.id}">${b.name}</option>`).join("")}</select>
    </label>
    <button class="btn primary" data-register>Kirim pendaftaran</button>
  </div>`;
}

function screenPending() {
  return `<div class="login">
    ${backBtn("login")}
    <div class="mark">Ci</div>
    <h1>Nunggu Owner</h1>
    <p class="lede">Belum bisa buka antrian sebelum ${state.ownerName} setujui.</p>
    <div class="card"><div class="name">Fajar Putra</div><div class="meta">Kasir · ${branchOf("melati").name}</div></div>
    <button class="btn ghost" data-go="login">Kembali ke masuk</button>
  </div>`;
}

function screenRejected() {
  return `<div class="login">
    ${backBtn("login")}
    <h1>Ditolak</h1>
    <p class="lede">Hubungi ${state.ownerName}.</p>
    <button class="btn primary" data-go="login">Ke halaman masuk</button>
  </div>`;
}

function screenHome() {
  const pending = state.users.filter((u) => u.status === "pending").length;
  const all = visibleQueue();
  const gantung = all.filter(hanging);
  const done = all.filter((q) => !hanging(q));
  const list = state.queueFilter === "selesai" ? done : state.queueFilter === "do" ? all.filter((q) => q.dropOut) : gantung;
  const waPend = all.filter((q) => !q.waSent).length;
  const b = currentBranch();

  if (state.role === "supervisor") {
    return `<div class="screen has-fab">
      <div class="top">${backBtn()}<div><p class="sub">SPV · ${b.name}</p><h1>Antrian</h1></div></div>
      <p class="meta" style="margin-bottom:10px">${b.location}</p>
      <div class="stats">
        <div class="stat"><div class="k">Gantung</div><div class="v">${gantung.length}</div></div>
        <div class="stat"><div class="k">Selesai</div><div class="v">${done.length}</div></div>
        <div class="stat"><div class="k">Stok</div><div class="v">${state.products.length}</div></div>
      </div>
      <div class="segment tight">
        <button class="${state.queueFilter === "gantung" ? "on" : ""}" data-qfilter="gantung">Menggantung</button>
        <button class="${state.queueFilter === "selesai" ? "on" : ""}" data-qfilter="selesai">Selesai</button>
      </div>
      ${list.map(queueCard).join("") || `<p class="empty">Kosong</p>`}
    </div>`;
  }

  return `<div class="screen has-fab">
    <div class="top">${backBtn()}<div>
      <p class="sub">${state.role === "owner" ? state.ownerName : currentActor() + " · " + b.name}</p>
      <h1>Antrian</h1>
    </div></div>
    ${branchPicker()}
    ${kasirPicker()}
    ${
      state.role === "owner"
        ? `<button class="card tap" data-go="analytics"><div class="name">Analytics keuangan</div><div class="meta">Harian · mingguan · bulanan · tahunan per cabang & kasir</div></button>`
        : ""
    }
    ${state.role === "owner" && pending ? `<button class="card tap warn" data-go="users"><div class="name">${pending} pengajuan akun</div><div class="meta">Kasir / SPV per cabang</div></button>` : ""}
    ${
      state.role !== "supervisor"
        ? `<div class="hero">
            <div class="k">${state.role === "owner" ? "Gabungan kasir di cabang ini" : "Shift " + currentActor()}</div>
            <div class="v">${Rp(state.viewBranch === "cibaduyut" ? 28000 : 1284000)}</div>
            <div class="hero-row">
              <span class="pill">${gantung.length} menggantung</span>
              <span class="pill">${waPend} WA pending</span>
              <span class="pill">${done.length} beres</span>
            </div>
          </div>`
        : ""
    }
    <div class="segment tight">
      <button class="${state.queueFilter === "gantung" ? "on" : ""}" data-qfilter="gantung">Menggantung</button>
      <button class="${state.queueFilter === "selesai" ? "on" : ""}" data-qfilter="selesai">Selesai</button>
      <button class="${state.queueFilter === "do" ? "on" : ""}" data-qfilter="do">Drop Out</button>
    </div>
    <p class="section-label">Gantung = laundry atau bayar belum beres</p>
    ${list.map(queueCard).join("") || `<p class="empty">Tidak ada nota di filter ini</p>`}
    ${state.role === "kasir" || state.role === "owner" ? `<button class="btn ghost" data-go="tutup-kas">Tutup kas</button>` : ""}
    ${state.role !== "supervisor" ? `<button class="fab" data-go="kasir">+ Nota baru</button>` : ""}
  </div>`;
}

function screenCustomers() {
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">${currentBranch().name}</p><h1>Pelanggan</h1></div></div>
    <input class="search" placeholder="Cari nama atau HP" />
    ${CUSTOMERS.map((c) => `
      <button class="card tap" data-pick-customer="${c.id}" data-go="kasir">
        <div class="row">
          <div class="avatar">${c.initials}</div>
          <div class="grow">
            <div class="name">${c.name}</div>
            <div class="meta">${c.address}</div>
            <div class="meta">${c.phone}</div>
            ${c.due ? `<div class="meta due">Sisa tagihan ${Rp(c.due)}</div>` : `<div class="meta">Lunas</div>`}
          </div>
        </div>
      </button>`).join("")}
    <button class="fab" data-go="customer-form">+ Pelanggan</button>
  </div>`;
}

function screenCustomerForm() {
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Pelanggan baru</h1><span></span></div>
    <label class="form"><span>Nama</span><input placeholder="Nama lengkap" /></label>
    <label class="form"><span>Alamat</span><textarea rows="2" placeholder="Alamat"></textarea></label>
    <label class="form"><span>No. HP / WhatsApp</span><input placeholder="08xxxxxxxxxx" /></label>
    <button class="btn primary" data-toast="Pelanggan tersimpan" data-go="customers">Simpan</button>
  </div>`;
}

function screenKasir() {
  const c = state.customer;
  const b = currentBranch();
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">${b.name} · ID berikutnya ${nextNotaId(b.id)}</p><h1>Nota baru</h1></div></div>
    <button class="card tap" data-go="customers">
      <div class="row">
        <div class="avatar">${c.initials}</div>
        <div class="grow">
          <div class="name">${c.name}</div>
          <div class="meta">${c.phone}</div>
          <div class="meta">${c.address}</div>
        </div>
        <span class="meta">ganti</span>
      </div>
    </button>
    <div class="section-label">Layanan <span>retail otomatis potong stok</span></div>
    <div class="grid-svc">${SERVICES.map(svcTile).join("")}</div>
    <div class="cart dock">
      ${
        state.cart.length
          ? state.cart.map((i) => `<div class="cart-item"><span>${i.name} · ${i.qty} ${i.unit}</span><b>${Rp(i.qty * i.price)}</b></div>`).join("") +
            `<div class="cart-item"><span>Total</span><b>${Rp(cartTotal())}</b></div>
             <button class="btn primary" data-go="bayar">Lanjut: janji & bayar</button>`
          : `<p class="empty" style="padding:8px">Tap layanan. Qty sesuai tarif kg atau pcs.</p>`
      }
    </div>
  </div>`;
}

function screenBayar() {
  const total = cartTotal() || 85000;
  const paid = state.paid;
  const lunas = paid >= total;
  const sisa = Math.max(total - paid, 0);
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Janji & bayar</h1><span></span></div>
    <div class="pay-box">
      <p class="sub">Total nota</p>
      <div class="total">${Rp(total)}</div>
      ${chipStatus(lunas ? "lunas" : "belum", lunas ? "Lunas" : "Belum lunas")}
    </div>
    <label class="form"><span>Kapan selesai / bisa pickup</span><input id="promise-input" value="${state.promise}" /></label>
    <p class="section-label">Metode</p>
    <div class="methods">
      ${["tunai", "qris", "transfer"].map((m) => `<button class="${state.payMethod === m ? "on" : ""}" data-method="${m}">${{ tunai: "Tunai", qris: "QRIS", transfer: "Transfer" }[m]}</button>`).join("")}
    </div>
    <label class="form"><span>Dibayar sekarang</span><input id="paid-input" inputmode="numeric" value="${paid}" /></label>
    <div class="pay-quick">
      <button data-paid="0">0 · Belum lunas</button>
      <button data-paid="${total}">Lunas</button>
    </div>
    <p class="sisa">Sisa tagihan <b>${Rp(sisa)}</b></p>
    <button class="btn primary" data-go="nota">Simpan nota</button>
  </div>`;
}

function exportNota(kind, order) {
  const text = notaText(order);
  if (kind === "text") {
    navigator.clipboard?.writeText(text);
    showToast("Teks nota tersalin");
    return;
  }
  if (kind === "xlsx") {
    const o = order || activeQueue();
    const b = branchOf(o.branch);
    const csv = `ID,Cabang,Waktu,Kasir,Pelanggan,HP,Item,Total,Dibayar,Status bayar,Status laundry,Pickup\n${o.id},${b.name},${o.createdAt},${o.kasir},${o.customer},${o.phone},"${o.items}",${o.total},${o.paid},${payChip(o).label},${laundryMeta(o.laundry).label},${o.pickupAt}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${o.id}.csv`;
    a.click();
    showToast("Excel (CSV) terunduh");
    return;
  }
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(`<html><head><title>${order?.id || "Nota"}</title></head><body style="font-family:sans-serif;padding:24px;white-space:pre-wrap">${text}\n\nPrint → Save as PDF</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }
  showToast("PDF: Print / Save as PDF");
}

function screenNota() {
  const c = state.customer;
  const draft = {
    id: nextNotaId(currentBranch().id),
    branch: currentBranch().id,
    kasir: currentActor(),
    customer: c.name,
    phone: c.phone,
    address: c.address,
    items: (state.cart.length ? state.cart : [{ name: "Curing DO", qty: 3, unit: "kg", price: 10000 }]).map((i) => `${i.name} ${i.qty} ${i.unit}`).join(", "),
    total: cartTotal() || 30000,
    paid: state.paid,
    pay: state.paid >= (cartTotal() || 30000) ? "lunas" : "belum",
    laundry: "masuk",
    promise: state.promise,
    pickupAt: state.promise,
    createdAt: "10 Sep 2026, 09.41",
  };
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Nota ${draft.id}</h1><span></span></div>
    <p class="meta" style="margin-bottom:8px">${currentBranch().name} · ${draft.kasir} · ${draft.createdAt}</p>
    <div class="nota">${notaText(draft)}</div>
    <div class="row-actions">
      <button class="btn ghost" data-nota-export="text">Teks</button>
      <button class="btn ghost" data-nota-export="xlsx">Excel</button>
      <button class="btn ghost" data-nota-export="pdf">PDF</button>
    </div>
    <button class="btn wa" data-save-nota="send">Simpan & kirim WA</button>
    <button class="btn ghost" data-save-nota="later">Simpan, WA nanti</button>
  </div>`;
}

function waScreen(kind) {
  const o = kind === "siap" ? activeQueue() : activeQueue();
  const c = { name: o.customer, phone: o.phone, initials: personInitials(o.customer) };
  const body = kind === "siap" ? siapText(o) : notaText(o);
  return `<div class="screen" style="padding:0">
    <div class="wa-app">
      <div class="wa-head">
        ${backBtn()}
        <div class="avatar">${c.initials || "WA"}</div>
        <div class="grow">
          <div class="name">${c.name}</div>
          <div class="meta">${c.phone} · ${o.id}</div>
        </div>
      </div>
      ${state.waSent ? `<div class="wa-sent-banner">${kind === "siap" ? "Siap ambil terkirim" : "Nota terkirim"} · masuk archive</div>` : ""}
      <div class="wa-thread">
        <div class="wa-bubble">${body}<div class="wa-time">${state.waSent ? "09.41 ✓✓" : "draft"}</div></div>
      </div>
      ${
        state.waSent
          ? `<button class="btn primary" style="margin:0 12px 16px;width:auto" data-go="wa-archive">Lihat archive WA</button>`
          : `<div class="wa-composer"><p class="hint">Kirim dari HP · list pending tetap ada sampai terkirim</p>
              <button class="wa-send" data-wa-send aria-label="Kirim">➤</button></div>`
      }
    </div>
  </div>`;
}

function screenWaChat() {
  return waScreen("nota");
}
function screenWaReady() {
  return waScreen("siap");
}

function screenWaOutbox() {
  const pending = visibleQueue().filter((q) => !q.waSent);
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Belum dikirim</p><h1>WA pending</h1></div></div>
    <div class="segment tight">
      <button class="on" data-go="wa-outbox">Pending</button>
      <button data-go="wa-archive">Archive</button>
    </div>
    <p class="meta" style="margin-bottom:10px">List ini tetap ada selama belum dikirim. Setelah kirim, pindah ke archive.</p>
    ${
      pending.map((o) => `<div class="card">
        <div class="name">${o.id} · ${o.customer}</div>
        <div class="meta">${o.phone} · ${o.createdAt}</div>
        <div class="row-actions">
          <button class="btn wa" data-open-queue="${o.id}" data-wa="nota">Kirim sekarang</button>
        </div>
      </div>`).join("") || `<p class="empty">Semua nota sudah dikirim WA</p>`
    }
  </div>`;
}

function screenWaArchive() {
  const sent = visibleQueue().filter((q) => q.waSent);
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Sudah dikirim, tetap bisa dibuka</p><h1>WA archive</h1></div></div>
    <div class="segment tight">
      <button data-go="wa-outbox">Pending</button>
      <button class="on" data-go="wa-archive">Archive</button>
    </div>
    ${
      sent.map((o) => `<button class="card tap" data-open-queue="${o.id}">
        <div class="name">${o.id} · ${o.customer}</div>
        <div class="meta">Terkirim ${o.waAt} · ${o.phone}</div>
      </button>`).join("") || `<p class="empty">Archive kosong</p>`
    }
  </div>`;
}

function screenQueueDetail() {
  const o = activeQueue();
  const pay = payChip(o);
  const hang = hanging(o);
  const b = branchOf(o.branch);
  const next = laundryMeta(o.laundry).next;
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>${o.id}</h1><span></span></div>
    <div class="card">
      <div class="name">${o.customer}</div>
      <div class="meta">${o.phone} · kasir ${o.kasir}</div>
      <div class="meta">${b.name} · ${b.location}</div>
      <div class="meta"><a href="${b.maps}" target="_blank" rel="noopener">Maps ${b.mapsLabel}</a></div>
      <div class="meta">${o.items}</div>
      <div class="meta">Dibuat ${o.createdAt}</div>
      <div class="meta">Pickup ${o.pickupAt}</div>
      <div class="chip-row">${chipStatus(pay.id, pay.label)} ${chipStatus(o.laundry, laundryMeta(o.laundry).label)} ${hang ? '<span class="chip belum">Menggantung</span>' : '<span class="chip lunas">Beres</span>'}</div>
    </div>
    <p class="section-label">Status laundry</p>
    ${stepper(o.laundry)}
    ${
      o.laundry !== "selesai" && state.role !== "owner"
        ? `<button class="btn primary" data-advance-pipe>Lanjut: ${laundryMeta(next).label}</button>`
        : ""
    }
    ${
      o.pay !== "lunas" && state.role !== "supervisor"
        ? `<button class="btn ghost" data-open-order="${o.id}">Tandai lunas / pelunasan</button>`
        : ""
    }
    <p class="section-label">Bukti di HP <span>bukan cloud</span></p>
    ${(o.photos || []).map((p) => `<div class="card"><div class="name">📷 ${p.name}</div><div class="meta">Lokal handphone kasir</div></div>`).join("") || `<p class="meta">Belum ada foto/dokumen</p>`}
    ${
      state.role !== "supervisor"
        ? `<label class="form"><span>Upload bukti (tersimpan di HP)</span><input type="file" accept="image/*,.pdf" id="bukti-file" /></label>`
        : ""
    }
    <div class="row-actions">
      <button class="btn ghost" data-nota-export="text">Teks</button>
      <button class="btn ghost" data-nota-export="xlsx">Excel</button>
      <button class="btn ghost" data-nota-export="pdf">PDF</button>
    </div>
    ${!o.waSent ? `<button class="btn wa" data-wa="nota">Kirim WA nota</button>` : `<button class="btn ghost" data-go="wa-archive">Sudah di archive WA</button>`}
    ${o.laundry === "selesai" ? `<button class="btn wa" data-wa="siap">WA siap diambil</button>` : ""}
  </div>`;
}

function screenOrders() {
  const q = state.searchQ.toLowerCase();
  const rows = visibleQueue().filter((o) => !q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.phone.includes(q));
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">ID beda per cabang</p><h1>Cari nota</h1></div></div>
    <input class="search" id="nota-search" placeholder="MEL-2409… atau nama" value="${state.searchQ}" />
    ${rows.map(queueCard).join("") || `<p class="empty">Tidak ketemu</p>`}
  </div>`;
}

function screenPelunasan() {
  const o = state.payTarget || visibleQueue().find((x) => x.pay !== "lunas") || activeQueue();
  const sisa = o.total - o.paid;
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Pelunasan</h1><span></span></div>
    <div class="card">
      <div class="name">${o.id} · ${o.customer}</div>
      <p class="sisa">Sisa tagihan <b>${Rp(sisa)}</b></p>
    </div>
    <label class="form"><span>Bayar tambahan</span><input value="${sisa}" /></label>
    <button class="btn primary" data-mark-lunas="${o.id}">Tandai lunas</button>
  </div>`;
}

function screenLayanan() {
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Modul layanan</p><h1>Layanan</h1></div></div>
      ${SERVICES.map((s) => {
        const ico = SVC_ICON[s.id] || SVC_ICON.cuci;
        return `<button class="card tap" data-go="layanan-form">
        <div class="row">
          <div class="svc-ico" style="background:${ico.bg}">${ico.svg}</div>
          <div class="grow">
            <div class="name">${s.name} ${s.dropOut ? '<span class="chip do">Drop Out</span>' : ""}</div>
            <div class="meta">${Rp(s.price)} / ${s.unit === "kg" ? "kiloan" : "satuan"}</div>
          </div>
        </div>
      </button>`;
      }).join("")}
    <button class="fab" data-go="layanan-form">+ Layanan</button>
  </div>`;
}

function screenLayananForm() {
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Layanan</h1><span></span></div>
    <label class="form"><span>Nama</span><input value="Curing DO Lipat" /></label>
    <label class="form"><span>Keterangan</span><textarea rows="2">Drop Out + dilipat rapi</textarea></label>
    <label class="form"><span>Tarif (Rp)</span><input value="12000" /></label>
    <label class="form"><span>Hitung sebagai</span>
      <select><option>Kiloan (kg)</option><option>Satuan (pcs)</option></select>
    </label>
    <div class="toggle">Drop Out<button class="switch on" type="button" data-toggle-switch><i></i></button></div>
    <button class="btn primary" data-toast="Layanan tersimpan" data-go="layanan">Simpan</button>
    <button class="btn danger" data-toast="Layanan dihapus" data-go="layanan">Hapus</button>
  </div>`;
}

function screenInventory() {
  const moves = state.stockMoves.filter((m) => state.role === "owner" || m.branch === currentBranch().id);
  const periodLabel = { hari: "Hari ini", "7hari": "7 hari", bulan: "Bulan ini" }[state.stockPeriod] || "7 hari";
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Track per periode</p><h1>Stok</h1></div></div>
    <div class="segment tight">
      <button class="${state.stockPeriod === "hari" ? "on" : ""}" data-speriod="hari">Harian</button>
      <button class="${state.stockPeriod === "7hari" ? "on" : ""}" data-speriod="7hari">7 hari</button>
      <button class="${state.stockPeriod === "bulan" ? "on" : ""}" data-speriod="bulan">Bulanan</button>
    </div>
    ${state.products.map((p) => {
      const rel = moves.filter((m) => m.product === p.name);
      const jual = rel.filter((m) => m.kind === "jual").reduce((s, m) => s + m.qty, 0);
      const manual = rel.filter((m) => m.kind !== "jual").reduce((s, m) => s + (typeof m.qty === "number" && m.kind !== "update" ? m.qty : 0), 0);
      return `<div class="card">
        <div class="name">${p.name} ${p.stock <= p.min ? '<span class="chip belum">Rendah</span>' : ""}</div>
        <div class="meta">Sisa ${p.stock} · ${periodLabel}</div>
        <div class="meta">Jual via nota ${jual} · edit manual ${manual > 0 ? "+" + manual : manual}</div>
      </div>`;
    }).join("")}
    <button class="btn ghost" data-go="stok-history">Lihat mutasi tanggal</button>
    ${state.role !== "supervisor" ? `<button class="fab" data-go="stok-edit">Ubah stok</button>` : ""}
  </div>`;
}

function screenStokMasuk() {
  return screenStokEdit();
}

function screenStokEdit() {
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Ubah stok</h1><span></span></div>
    <p class="meta" style="margin-bottom:10px">Bisa berkurang otomatis pas pelanggan beli retail, atau kasir edit manual.</p>
    <label class="form"><span>Produk</span>
      <select id="stok-produk">${state.products.map((p) => `<option>${p.name}</option>`).join("")}</select>
    </label>
    <div class="segment tight">
      <button class="${state.stockEditKind === "tambah" ? "on" : ""}" data-skind="tambah">Tambah</button>
      <button class="${state.stockEditKind === "kurang" ? "on" : ""}" data-skind="kurang">Kurang</button>
      <button class="${state.stockEditKind === "update" ? "on" : ""}" data-skind="update">Update</button>
    </div>
    <label class="form"><span>Jumlah</span><input id="stok-qty" value="12" /></label>
    <button class="btn primary" data-save-stok>Simpan mutasi</button>
  </div>`;
}

function screenStokHistory() {
  const rows = state.stockMoves.filter((m) => state.role === "owner" || m.branch === currentBranch().id);
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Perubahan per tanggal</p><h1>Mutasi stok</h1></div></div>
    ${rows.map((m) => `<div class="card">
      <div class="name">${m.product} · ${m.kind} ${m.kind === "update" ? "→ " + m.qty : m.qty}</div>
      <div class="meta">${m.at} · ${m.by} · ${branchOf(m.branch).name}</div>
      <div class="meta">${m.nota ? "Nota " + m.nota : m.note || "Manual"}</div>
    </div>`).join("")}
  </div>`;
}

function screenUsers() {
  const list = state.users.filter((u) => (state.userFilter === "pengajuan" ? u.status === "pending" : u.status === "approved"));
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">1 cabang: ≥1 kasir + SPV</p><h1>User</h1></div></div>
    <div class="segment tight">
      <button class="${state.userFilter === "pengajuan" ? "on" : ""}" data-ufilter="pengajuan">Pengajuan</button>
      <button class="${state.userFilter === "aktif" ? "on" : ""}" data-ufilter="aktif">Aktif</button>
    </div>
    ${list.map((u) => `
      <div class="card">
        <div class="name">${u.name}</div>
        <div class="meta">${u.role} · ${(u.branches || []).map((id) => branchOf(id).name.replace("Cuciin ", "")).join(", ")}</div>
        ${u.status === "pending" ? `<div class="row-actions">
          <button class="btn primary" data-approve="${u.name}">Setujui</button>
          <button class="btn danger" data-reject="${u.name}">Tolak</button>
        </div>` : ""}
      </div>`).join("") || `<p class="empty">Kosong</p>`}
  </div>`;
}

function screenRoles() {
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Modular per modul</p><h1>Role</h1></div></div>
    ${state.roles.map((r) => `
      <div class="card">
        <div class="name">${r.name} ${r.owner ? '<span class="chip pipe">bukan daftar publik</span>' : ""}</div>
        <div class="meta">${r.modules.map((id) => MODULES.find((m) => m.id === id)?.label).join(" · ")}</div>
      </div>`).join("")}
    <div class="card">
      <div class="name">Tambah role</div>
      <label class="form"><span>Nama role</span><input id="new-role-name" placeholder="contoh: Setrika" /></label>
      ${MODULES.map((m) => `<div class="toggle">${m.label}<button class="switch" type="button" data-toggle-switch><i></i></button></div>`).join("")}
      <button class="btn primary" data-add-role>Simpan role</button>
    </div>
  </div>`;
}

function screenBranches() {
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Database cabang</p><h1>Laundry</h1></div></div>
    ${BRANCHES.map((b) => {
      const kasir = state.users.filter((u) => u.role === "Kasir" && u.status === "approved" && u.branches.includes(b.id));
      const spv = state.users.filter((u) => u.role === "Supervisor" && u.status === "approved" && u.branches.includes(b.id));
      return `<div class="card">
        <div class="name">${b.name}</div>
        <div class="meta">${b.location}</div>
        <div class="meta"><a href="${b.maps}" target="_blank" rel="noopener">Maps ${b.mapsLabel}</a></div>
        <div class="meta">Kasir: ${kasir.map((k) => k.name).join(", ") || "—"}</div>
        <div class="meta">SPV: ${spv.map((k) => k.name).join(", ") || "—"}</div>
        <div class="meta">Kode nota ${b.code}-… (beda dari cabang lain)</div>
      </div>`;
    }).join("")}
    <button class="fab" data-go="branch-form">+ Cabang</button>
  </div>`;
}

function screenBranchForm() {
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Cabang baru</h1><span></span></div>
    <label class="form"><span>Nama laundry</span><input placeholder="Cuciin …" /></label>
    <label class="form"><span>Lokasi</span><textarea rows="2" placeholder="Alamat cabang"></textarea></label>
    <label class="form"><span>Titik Google Maps</span><input placeholder="-6.91, 107.61" /></label>
    <button class="btn primary" data-toast="Cabang tersimpan (mock)" data-go="branches">Simpan</button>
  </div>`;
}

function screenProfil() {
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Profil usaha</h1><span></span></div>
    <label class="form"><span>Owner</span><input value="${state.ownerName}" /></label>
    <label class="form"><span>Email Owner</span><input id="owner-email" value="${state.ownerEmail}" /></label>
    <p class="meta" style="margin-bottom:12px">Cabang dikelola di modul Laundry, bukan di sini.</p>
    <button class="btn ghost" data-toast="Permintaan hapus akun (syarat Play)">Hapus akun saya</button>
    <button class="btn primary" data-save-profil>Simpan</button>
  </div>`;
}

function reportData() {
  const period = {
    hari: { label: "Hari ini · 10 Sep 2026", omzet: 1284000, nota: 4, gantung: 2, bars: [20, 40, 35, 70, 90, 55, 78] },
    minggu: { label: "Minggu ini · 4–10 Sep", omzet: 3210000, nota: 18, gantung: 5, bars: [40, 55, 35, 70, 90, 60, 78] },
    bulan: { label: "September 2026", omzet: 12840000, nota: 86, gantung: 11, bars: [30, 45, 50, 62, 80, 70, 88] },
    tahun: { label: "2026", omzet: 86400000, nota: 640, gantung: 18, bars: [22, 40, 48, 55, 70, 80, 90] },
  }[state.reportPeriod];
  const bMul = state.viewBranch === "cibaduyut" ? 0.22 : state.viewBranch === "all" ? 1 : 0.78;
  const kMul = state.viewKasir === "Dedi" ? 0.35 : state.viewKasir === "Salsa" ? 0.22 : state.viewKasir === "Rina" ? 0.43 : 1;
  const mul = bMul * (state.viewKasir === "all" ? 1 : kMul);
  return {
    ...period,
    omzet: Math.round(period.omzet * mul),
    nota: Math.max(1, Math.round(period.nota * mul)),
    gantung: Math.round(period.gantung * (state.viewBranch === "all" ? 1 : 0.7)),
  };
}

function screenAnalytics() {
  const r = reportData();
  const perKasir = state.users.filter((u) => u.role === "Kasir" && u.status === "approved" && (state.viewBranch === "all" || u.branches.includes(state.viewBranch)));
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Owner · ${state.ownerName}</p><h1>Analytics</h1></div></div>
    <div class="segment tight wrap">
      ${["hari", "minggu", "bulan", "tahun"].map((p) => `<button class="${state.reportPeriod === p ? "on" : ""}" data-rperiod="${p}">${{ hari: "Harian", minggu: "Mingguan", bulan: "Bulanan", tahun: "Tahunan" }[p]}</button>`).join("")}
    </div>
    ${branchPicker()}
    ${kasirPicker()}
    <p class="meta" style="margin-bottom:10px">${r.label} · data = gabungan kasir di cabang</p>
    <div class="hero">
      <div class="k">Omzet</div>
      <div class="v">${Rp(r.omzet)}</div>
      <div class="hero-row">
        <span class="pill">${r.nota} nota</span>
        <span class="pill">${r.gantung} menggantung</span>
      </div>
    </div>
    <div class="card">
      <div class="name">Tren periode</div>
      <div class="bars">${r.bars.map((h) => `<i style="height:${h}%"></i>`).join("")}</div>
    </div>
    <p class="section-label">Pecah per kasir</p>
    ${perKasir.map((k, i) => `<div class="card">
      <div class="name">${k.name}</div>
      <div class="meta">${(k.branches || []).map((id) => branchOf(id).name.replace("Cuciin ", "")).join(", ")}</div>
      <div class="cart-item"><span>Omzet kasir ini</span><b>${Rp(Math.round(r.omzet * [0.48, 0.32, 0.2][i] || r.omzet * 0.2))}</b></div>
    </div>`).join("")}
    <button class="btn primary" data-export="xlsx">Export Excel</button>
    <button class="btn ghost" data-export="pdf">Export PDF</button>
  </div>`;
}

function screenLaporan() {
  return screenAnalytics();
}

function screenAudit() {
  const rows = state.audit.filter((a) => state.role === "owner" || a.branch === currentBranch().id);
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Semua transaksi</p><h1>Audit trail</h1></div></div>
    ${rows.map((a) => `<button class="card tap" ${a.nota ? `data-open-queue="${a.nota}"` : ""}>
      <div class="name">${a.action}</div>
      <div class="meta">${a.at} · ${a.user} · ${branchOf(a.branch).name}</div>
      ${a.nota ? `<div class="meta">${a.nota}</div>` : ""}
    </button>`).join("")}
  </div>`;
}

function screenModules() {
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Bisa diubah per modul</p><h1>Modul</h1></div></div>
    ${MODULES.map((m) => {
      const go = { dashboard: "home", pelanggan: "customers", transaksi: "kasir", wa: "wa-outbox", layanan: "layanan", inventory: "inventory", kas: "tutup-kas", cabang: "branches", user: "users", role: "roles", audit: "audit", laporan: "analytics", profil: "profil" }[m.id];
      return `<button class="card tap" data-go="${go}"><div class="name">${m.label}</div><div class="meta">modul ${m.id}</div></button>`;
    }).join("")}
  </div>`;
}

function screenTutupKas() {
  return `<div class="screen">
    <div class="top">${backBtn()}<h1>Tutup kas</h1><span></span></div>
    <p class="meta" style="margin-bottom:12px">${currentActor()} · ${currentBranch().name} · 10 Sep 2026</p>
    <div class="card">
      <div class="cart-item"><span>Modal awal</span><b>${Rp(300000)}</b></div>
      <div class="cart-item"><span>Tunai sistem</span><b>${Rp(420000)}</b></div>
      <div class="cart-item"><span>QRIS</span><b>${Rp(185000)}</b></div>
      <div class="cart-item"><span>Transfer</span><b>${Rp(90000)}</b></div>
      <div class="cart-item"><span>Piutang menggantung</span><b>${Rp(54000)}</b></div>
    </div>
    <label class="form"><span>Tunai di laci (hitung)</span><input value="420000" /></label>
    <p class="sisa">Selisih <b>Rp 0</b></p>
    <button class="btn primary" data-toast="Kas ditutup" data-go="home">Tutup shift</button>
  </div>`;
}

function screenMore() {
  return `<div class="screen">
    <div class="top">${backBtn()}<div><p class="sub">Owner</p><h1>Modul</h1></div></div>
    <div class="menu-list">
      <button data-go="analytics">Analytics keuangan <span>›</span></button>
      <button data-go="branches">Cabang laundry <span>›</span></button>
      <button data-go="wa-outbox">WA pending <span>›</span></button>
      <button data-go="wa-archive">WA archive <span>›</span></button>
      <button data-go="audit">Audit trail <span>›</span></button>
      <button data-go="orders">Cari nota <span>›</span></button>
      <button data-go="tutup-kas">Tutup kas <span>›</span></button>
      <button data-go="layanan">Layanan <span>›</span></button>
      <button data-go="users">User & pengajuan <span>›</span></button>
      <button data-go="roles">Role & akses <span>›</span></button>
      <button data-go="modules">Peta modul <span>›</span></button>
      <button data-go="profil">Profil <span>›</span></button>
      <button data-go="login">Keluar <span>›</span></button>
    </div>
  </div>`;
}

const SCREENS = {
  login: screenLogin,
  register: screenRegister,
  pending: screenPending,
  rejected: screenRejected,
  home: screenHome,
  customers: screenCustomers,
  "customer-form": screenCustomerForm,
  kasir: screenKasir,
  bayar: screenBayar,
  nota: screenNota,
  "wa-chat": screenWaChat,
  "wa-ready": screenWaReady,
  "wa-outbox": screenWaOutbox,
  "wa-archive": screenWaArchive,
  "queue-detail": screenQueueDetail,
  orders: screenOrders,
  pelunasan: screenPelunasan,
  layanan: screenLayanan,
  "layanan-form": screenLayananForm,
  inventory: screenInventory,
  "stok-masuk": screenStokMasuk,
  "stok-edit": screenStokEdit,
  "stok-history": screenStokHistory,
  users: screenUsers,
  roles: screenRoles,
  branches: screenBranches,
  "branch-form": screenBranchForm,
  profil: screenProfil,
  laporan: screenLaporan,
  analytics: screenAnalytics,
  audit: screenAudit,
  modules: screenModules,
  "tutup-kas": screenTutupKas,
  more: screenMore,
};

function qtySheet() {
  if (!state.sheet) return "";
  const s = SERVICES.find((x) => x.id === state.sheet);
  return `<div class="sheet-bg" data-close-sheet>
    <div class="sheet" data-stop>
      <div class="grab"></div>
      ${SVC_ICON[s.id] ? `<div class="svc-ico" style="background:${SVC_ICON[s.id].bg};margin:0 auto 8px">${SVC_ICON[s.id].svg}</div>` : ""}
      <h2>${s.name}</h2>
      <p class="meta">${s.desc} · ${Rp(s.price)} / ${s.unit}${s.retail ? " · potong stok" : ""}</p>
      <div class="qty-row">
        <button data-qty="-1">−</button>
        <strong>${state.qtyDraft} ${s.unit}</strong>
        <button data-qty="1">+</button>
      </div>
      <button class="btn primary" data-add-cart="${s.id}">Tambah · ${Rp(state.qtyDraft * s.price)}</button>
    </div>
  </div>`;
}

function renderTabbar() {
  const bar = document.getElementById("tabbar");
  const hide =
    !state.loggedIn ||
    AUTH.includes(state.screen) ||
    ["bayar", "nota", "customer-form", "layanan-form", "pelunasan", "stok-masuk", "stok-edit", "stok-history", "profil", "wa-chat", "wa-ready", "queue-detail", "tutup-kas", "laporan", "analytics", "audit", "branches", "branch-form", "modules", "wa-archive"].includes(state.screen);
  bar.hidden = hide;
  if (hide) {
    bar.innerHTML = "";
    return;
  }
  const tabs = TABS[state.role] || TABS.kasir;
  const active = tabs.some((t) => t.id === state.screen) ? state.screen : state.screen === "wa-outbox" ? "wa-outbox" : "";
  bar.innerHTML = tabs
    .map((t) => `<button class="${t.id === active ? "on" : ""}" data-go="${t.id}">${ICONS[t.icon]}${t.label}</button>`)
    .join("");
}

function renderJumps() {
  document.getElementById("screen-jump").innerHTML = JUMPS.map(
    (j) => `<button class="${j.id === state.screen ? "current" : ""}" data-jump="${j.id}">${j.label}</button>`
  ).join("");
}

function render() {
  const app = document.getElementById("app");
  const view = SCREENS[state.screen] || screenHome;
  app.innerHTML = view() + qtySheet() + (state.toast ? `<div class="toast">${state.toast}</div>` : "");
  renderTabbar();
  renderJumps();
  syncUrl();
}

function saveCurrentNota(sendWa) {
  const b = currentBranch();
  const id = nextNotaId(b.id);
  const total = cartTotal() || 30000;
  const paid = state.paid;
  const items = state.cart.length ? state.cart : [{ ...SERVICES[2], qty: 3 }];
  if (!state.queue.some((q) => q.id === id)) {
    state.queue.unshift({
      id,
      branch: b.id,
      kasir: currentActor(),
      customer: state.customer.name,
      phone: state.customer.phone,
      items: items.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", "),
      total,
      paid,
      pay: paid >= total ? "lunas" : "belum",
      laundry: "masuk",
      dropOut: items.some((i) => i.dropOut),
      promise: state.promise,
      pickupAt: state.promise,
      createdAt: "10 Sep 2026, 09.41",
      waSent: false,
      photos: [],
      late: false,
    });
    items.filter((i) => i.retail).forEach((i) => {
      const p = state.products.find((x) => x.name === i.name);
      if (p) p.stock = Math.max(0, p.stock - i.qty);
      state.stockMoves.unshift({ at: "10 Sep 09.41", product: i.name, kind: "jual", qty: -i.qty, by: currentActor(), branch: b.id, nota: id });
    });
    pushAudit(`Nota ${id} disimpan · ${paid >= total ? "Lunas" : "Belum lunas"}`, id);
  }
  state.activeQueueId = id;
  if (sendWa) {
    state.waKind = "nota";
    state.waSent = false;
    go("wa-chat");
  } else {
    showToast("Masuk list WA pending");
    go("wa-outbox");
  }
}

document.getElementById("role-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-role]");
  if (!btn) return;
  state.role = btn.dataset.role;
  state.actor = btn.dataset.role === "kasir" ? "Rina" : state.actor;
  [...document.getElementById("role-switch").children].forEach((b) => b.classList.toggle("on", b === btn));
  if (state.loggedIn) {
    state.history = [];
    state.screen = "home";
    state.sheet = null;
  }
  render();
});

document.body.addEventListener("click", (e) => {
  if (e.target.closest("[data-back]")) {
    goBack();
    return;
  }

  const jump = e.target.closest("[data-jump]");
  if (jump) {
    const id = jump.dataset.jump;
    if (!navAllowed(id) && !AUTH.includes(id)) {
      showToast("Role ini nggak punya modul itu");
      return;
    }
    go(id);
    return;
  }

  if (e.target.closest("[data-register]")) {
    const sel = document.getElementById("reg-role");
    const br = document.getElementById("reg-branch");
    const roleName = sel ? sel.value : "Kasir";
    const branch = br ? br.value : "melati";
    const u = state.users.find((x) => x.name === "Fajar Putra");
    if (u) {
      u.role = roleName;
      u.branches = [branch];
    } else state.users.push({ name: "Fajar Putra", role: roleName, status: "pending", branches: [branch] });
    go("pending");
    return;
  }

  if (e.target.closest("[data-add-role]")) {
    const input = document.getElementById("new-role-name");
    const name = (input && input.value.trim()) || "Setrika";
    if (!state.roles.some((r) => r.name === name)) state.roles.push({ name, modules: ["dashboard"] });
    showToast(`Role ${name} muncul di form Daftar`);
    return;
  }

  const rp = e.target.closest("[data-rperiod]");
  if (rp) {
    state.reportPeriod = rp.dataset.rperiod;
    render();
    return;
  }
  const br = e.target.closest("[data-branch]");
  if (br) {
    state.viewBranch = br.dataset.branch;
    state.viewKasir = "all";
    render();
    return;
  }
  const kk = e.target.closest("[data-kasir]");
  if (kk) {
    state.viewKasir = kk.dataset.kasir;
    render();
    return;
  }
  const sp = e.target.closest("[data-speriod]");
  if (sp) {
    state.stockPeriod = sp.dataset.speriod;
    render();
    return;
  }
  const sk = e.target.closest("[data-skind]");
  if (sk) {
    state.stockEditKind = sk.dataset.skind;
    render();
    return;
  }

  if (e.target.closest("[data-save-profil]")) {
    const em = document.getElementById("owner-email");
    if (em && em.value.trim()) state.ownerEmail = em.value.trim();
    showToast("Profil tersimpan");
    go("more");
    return;
  }

  if (e.target.closest("[data-save-stok]")) {
    const name = document.getElementById("stok-produk")?.value || "Sabun";
    const qty = Number(document.getElementById("stok-qty")?.value || 0);
    const p = state.products.find((x) => x.name === name);
    const kind = state.stockEditKind;
    let delta = qty;
    if (p) {
      if (kind === "tambah") p.stock += qty;
      if (kind === "kurang") {
        p.stock = Math.max(0, p.stock - qty);
        delta = -qty;
      }
      if (kind === "update") p.stock = qty;
    }
    state.stockMoves.unshift({ at: "10 Sep 09.41", product: name, kind, qty: kind === "update" ? qty : delta, by: currentActor(), branch: currentBranch().id, note: "Edit manual kasir" });
    pushAudit(`Stok ${name} ${kind} ${qty}`, "");
    showToast("Mutasi stok tercatat");
    go("stok-history");
    return;
  }

  const nexp = e.target.closest("[data-nota-export]");
  if (nexp) {
    exportNota(nexp.dataset.notaExport, ["nota"].includes(state.screen) ? null : activeQueue());
    return;
  }

  const saveN = e.target.closest("[data-save-nota]");
  if (saveN) {
    saveCurrentNota(saveN.dataset.saveNota === "send");
    return;
  }

  const exp = e.target.closest("[data-export]");
  if (exp) {
    const r = reportData();
    if (exp.dataset.export === "xlsx") {
      const csv = `Analytics Cuciin,${r.label}\nOwner,${state.ownerName}\nCabang,${state.viewBranch}\nKasir,${state.viewKasir}\nOmzet,${r.omzet}\nNota,${r.nota}\n`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = `analytics-cuciin.csv`;
      a.click();
      showToast("Excel (CSV) terunduh");
    } else {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<html><body style="font-family:sans-serif;padding:24px"><h1>Cuciin</h1><p>${state.ownerName}<br>${r.label}</p><p>Omzet ${Rp(r.omzet)}</p><p>Print → Save as PDF</p></body></html>`);
        w.document.close();
        w.focus();
        w.print();
      }
      showToast("PDF: Print / Save as PDF");
    }
    return;
  }

  const approve = e.target.closest("[data-approve]");
  if (approve) {
    const u = state.users.find((x) => x.name === approve.dataset.approve);
    if (u) u.status = "approved";
    showToast(`${approve.dataset.approve} disetujui`);
    return;
  }
  const reject = e.target.closest("[data-reject]");
  if (reject) {
    const u = state.users.find((x) => x.name === reject.dataset.reject);
    if (u) u.status = "rejected";
    showToast("Ditolak");
    return;
  }

  const qf = e.target.closest("[data-qfilter]");
  if (qf) {
    state.queueFilter = qf.dataset.qfilter;
    render();
    return;
  }
  const uf = e.target.closest("[data-ufilter]");
  if (uf) {
    state.userFilter = uf.dataset.ufilter;
    render();
    return;
  }

  const method = e.target.closest("[data-method]");
  if (method) {
    state.payMethod = method.dataset.method;
    render();
    return;
  }

  const openQ = e.target.closest("[data-open-queue]");
  if (openQ) {
    state.activeQueueId = openQ.dataset.openQueue;
    const wa = e.target.closest("[data-wa]");
    if (wa) {
      state.waKind = wa.dataset.wa || "nota";
      state.waSent = false;
      go(state.waKind === "siap" ? "wa-ready" : "wa-chat");
      return;
    }
    go("queue-detail");
    return;
  }

  if (e.target.closest("[data-advance-pipe]")) {
    const o = activeQueue();
    const next = laundryMeta(o.laundry).next;
    if (next) o.laundry = next;
    pushAudit(`${o.id} → ${laundryMeta(o.laundry).label}`, o.id);
    if (next === "selesai") {
      state.waKind = "siap";
      state.waSent = false;
      go("wa-ready");
      return;
    }
    render();
    return;
  }

  const lunasBtn = e.target.closest("[data-mark-lunas]");
  if (lunasBtn) {
    const o = state.queue.find((x) => x.id === lunasBtn.dataset.markLunas);
    if (o) {
      o.paid = o.total;
      o.pay = "lunas";
      pushAudit(`${o.id} ditandai Lunas`, o.id);
    }
    showToast("Status bayar: Lunas");
    go("queue-detail");
    return;
  }

  const goBtn = e.target.closest("[data-go]");
  if (goBtn && !e.target.closest("[data-jump]")) {
    if (goBtn.dataset.pickCustomer) {
      state.customer = CUSTOMERS.find((c) => c.id === goBtn.dataset.pickCustomer);
    }
    const id = goBtn.dataset.go;
    if (id === "login") {
      state.cart = [];
      state.paid = 0;
      state.waSent = false;
      state.history = [];
    }
    if ((id === "bayar" || id === "nota") && !state.cart.length) {
      state.cart = [{ ...SERVICES[2], qty: 3 }];
      state.paid = id === "nota" ? 30000 : 0;
    }
    go(id);
    if (goBtn.dataset.toast) showToast(goBtn.dataset.toast);
    return;
  }

  const openQty = e.target.closest("[data-open-qty]");
  if (openQty) {
    state.sheet = openQty.dataset.openQty;
    state.qtyDraft = SERVICES.find((s) => s.id === state.sheet).unit === "kg" ? 3 : 1;
    render();
    return;
  }
  if (e.target.closest("[data-close-sheet]") && !e.target.closest("[data-stop]")) {
    state.sheet = null;
    render();
    return;
  }
  const q = e.target.closest("[data-qty]");
  if (q) {
    const s = SERVICES.find((x) => x.id === state.sheet);
    const min = s.unit === "kg" ? 0.5 : 1;
    state.qtyDraft = Math.max(min, +(state.qtyDraft + Number(q.dataset.qty)).toFixed(1));
    render();
    return;
  }
  const add = e.target.closest("[data-add-cart]");
  if (add) {
    const s = SERVICES.find((x) => x.id === add.dataset.addCart);
    const exist = state.cart.find((i) => i.id === s.id);
    if (exist) exist.qty += state.qtyDraft;
    else state.cart.push({ ...s, qty: state.qtyDraft });
    state.sheet = null;
    render();
    return;
  }
  const paidBtn = e.target.closest("[data-paid]");
  if (paidBtn) {
    state.paid = Number(paidBtn.dataset.paid);
    render();
    return;
  }
  const order = e.target.closest("[data-open-order]");
  if (order) {
    const o = state.queue.find((x) => x.id === order.dataset.openOrder);
    state.payTarget = o;
    state.activeQueueId = o.id;
    if (o.pay === "lunas") {
      showToast("Nota ini sudah lunas");
      return;
    }
    go("pelunasan");
    return;
  }
  const wa = e.target.closest("[data-wa]");
  if (wa) {
    state.waKind = wa.dataset.wa || "nota";
    state.waSent = false;
    go(state.waKind === "siap" ? "wa-ready" : "wa-chat");
    return;
  }
  const waSend = e.target.closest("[data-wa-send]");
  if (waSend) {
    const o = activeQueue();
    o.waSent = true;
    o.waAt = "10 Sep 2026, 09.41";
    state.waSent = true;
    pushAudit(`WA ${state.waKind === "siap" ? "siap ambil" : "nota"} ${o.id} terkirim → archive`, o.id);
    render();
    return;
  }
  const sw = e.target.closest("[data-toggle-switch]");
  if (sw) {
    sw.classList.toggle("on");
    return;
  }
  const toastBtn = e.target.closest("[data-toast]");
  if (toastBtn && !toastBtn.dataset.go) showToast(toastBtn.dataset.toast);
});

document.body.addEventListener("input", (e) => {
  if (e.target.id === "paid-input") {
    state.paid = Number(String(e.target.value).replace(/\D/g, "")) || 0;
    const total = cartTotal() || 85000;
    const lunas = state.paid >= total;
    const sisa = Math.max(total - state.paid, 0);
    document.querySelector(".pay-box .chip")?.replaceWith(
      Object.assign(document.createElement("span"), { className: `chip ${lunas ? "lunas" : "belum"}`, textContent: lunas ? "Lunas" : "Belum lunas" })
    );
    const sisaEl = document.querySelector(".sisa");
    if (sisaEl) sisaEl.innerHTML = `Sisa tagihan <b>${Rp(sisa)}</b>`;
  }
  if (e.target.id === "promise-input") state.promise = e.target.value;
  if (e.target.id === "nota-search") state.searchQ = e.target.value;
  if (e.target.id === "bukti-file" && e.target.files?.[0]) {
    const o = activeQueue();
    o.photos = o.photos || [];
    o.photos.push({ name: e.target.files[0].name });
    pushAudit(`Bukti ${e.target.files[0].name} disimpan di HP (bukan cloud)`, o.id);
    showToast("Tersimpan di HP, bukan cloud");
  }
});

applyUrl();
render();
