const Rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const AUTH = ["login", "register", "pending", "rejected"];

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1z"/></svg>`,
  kasir: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M4 19a5 5 0 0 1 10 0"/><circle cx="17" cy="9" r="2"/><path d="M20 19a4 4 0 0 0-4-4"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8 12 4l9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>`,
};

const PIPE = [
  { id: "diterima", label: "Diterima", next: "dicuci" },
  { id: "dicuci", label: "Dicuci", next: "curing" },
  { id: "curing", label: "Curing", next: "dilipat" },
  { id: "dilipat", label: "Dilipat", next: "siap" },
  { id: "siap", label: "Siap ambil", next: "diambil" },
  { id: "diambil", label: "Diambil", next: null },
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

const CUSTOMERS = [
  { id: "c1", name: "Siti Rahma", address: "Jl. Melati 12, Bandung", phone: "0812-3301-8890", initials: "SR", due: 0 },
  { id: "c2", name: "Budi Santoso", address: "Komplek Cempaka Blok B2", phone: "0857-1120-4455", initials: "BS", due: 34000 },
  { id: "c3", name: "Dewi Lestari", address: "Jl. Anggrek No. 8", phone: "0813-7788-2210", initials: "DL", due: 28000 },
];

const MODULES = [
  { id: "dashboard", label: "Dashboard / antrian" },
  { id: "pelanggan", label: "Pelanggan" },
  { id: "transaksi", label: "Nota baru" },
  { id: "layanan", label: "Layanan" },
  { id: "inventory", label: "Inventory" },
  { id: "kas", label: "Tutup kas" },
  { id: "user", label: "User" },
  { id: "role", label: "Role & akses" },
  { id: "profil", label: "Profil usaha" },
  { id: "laporan", label: "Laporan" },
];

const state = {
  role: "kasir",
  screen: "login",
  authTab: "login",
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
  ownerEmail: "tiftazani.khara@gmail.com",
  reportPeriod: "minggu",
  queueFilter: "aktif",
  activeQueueId: "CU-2401-0042",
  searchQ: "",
  roles: [
    { name: "Owner", modules: MODULES.map((m) => m.id), owner: true },
    { name: "Kasir", modules: ["dashboard", "pelanggan", "transaksi", "inventory", "kas"] },
    { name: "Supervisor", modules: ["dashboard", "inventory"] },
    { name: "Operator Mesin", modules: ["dashboard"] },
  ],
  users: [
    { name: "Tiftazani", role: "Owner", status: "approved" },
    { name: "Rina", role: "Kasir", status: "approved" },
    { name: "Andi", role: "Supervisor", status: "approved" },
    { name: "Fajar Putra", role: "Kasir", status: "pending" },
    { name: "Mira", role: "Operator Mesin", status: "pending" },
  ],
  products: [
    { name: "Sabun", stock: 24, in: 10, out: 4, min: 8 },
    { name: "Softener", stock: 18, in: 8, out: 3, min: 6 },
    { name: "Parfum uk 100", stock: 9, in: 5, out: 2, min: 5 },
  ],
  queue: [
    { id: "CU-2401-0042", customer: "Siti Rahma", phone: "0812-3301-8890", items: "Curing DO 3 kg", total: 30000, paid: 30000, pay: "lunas", pipe: "dicuci", dropOut: true, promise: "Hari ini 17.00", late: false },
    { id: "CU-2401-0041", customer: "Budi Santoso", phone: "0857-1120-4455", items: "Cuci 5 kg", total: 54000, paid: 20000, pay: "dp", pipe: "siap", dropOut: false, promise: "Kemarin 16.00", late: true },
    { id: "CU-2401-0040", customer: "Dewi Lestari", phone: "0813-7788-2210", items: "Curing DO Lipat 2 kg", total: 28000, paid: 0, pay: "belum", pipe: "diterima", dropOut: true, promise: "Hari ini 18.00", late: false },
  ],
  orders: [
    { id: "CU-2401-0041", customer: "Budi Santoso", total: 54000, paid: 20000, dropOut: false },
    { id: "CU-2401-0040", customer: "Dewi Lestari", total: 28000, paid: 0, dropOut: true },
  ],
};

const TABS = {
  owner: [
    { id: "home", label: "Antrian", icon: "home" },
    { id: "kasir", label: "Nota", icon: "kasir" },
    { id: "customers", label: "Pelanggan", icon: "people" },
    { id: "inventory", label: "Stok", icon: "box" },
    { id: "more", label: "Lainnya", icon: "more" },
  ],
  kasir: [
    { id: "home", label: "Antrian", icon: "home" },
    { id: "kasir", label: "Nota", icon: "kasir" },
    { id: "customers", label: "Pelanggan", icon: "people" },
    { id: "inventory", label: "Stok", icon: "box" },
  ],
  supervisor: [{ id: "home", label: "Antrian", icon: "home" }],
};

const JUMPS = [
  { id: "login", label: "Login" },
  { id: "register", label: "Daftar" },
  { id: "pending", label: "Nunggu approve" },
  { id: "home", label: "Antrian" },
  { id: "kasir", label: "Nota baru" },
  { id: "bayar", label: "Bayar" },
  { id: "nota", label: "WA nota" },
  { id: "queue-detail", label: "Detail antrian" },
  { id: "wa-ready", label: "WA siap ambil" },
  { id: "tutup-kas", label: "Tutup kas" },
  { id: "customers", label: "Pelanggan" },
  { id: "orders", label: "Cari nota" },
  { id: "users", label: "User / pengajuan" },
  { id: "roles", label: "Role" },
  { id: "inventory", label: "Inventory" },
  { id: "layanan", label: "Layanan" },
  { id: "laporan", label: "Laporan Owner" },
];

function pipeMeta(id) {
  return PIPE.find((p) => p.id === id) || PIPE[0];
}

function payStatus(paid, total) {
  if (paid <= 0) return { id: "belum", label: "Belum lunas" };
  if (paid < total) return { id: "dp", label: "DP" };
  return { id: "lunas", label: "Lunas" };
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

function notaText() {
  const c = state.customer;
  const st = payStatus(state.paid, cartTotal() || 30000);
  const lines = (state.cart.length ? state.cart : [{ name: "Curing DO", qty: 3, unit: "kg", price: 10000 }])
    .map((i) => `• ${i.name} ${i.qty} ${i.unit} x ${Rp(i.price)} = ${Rp(i.qty * i.price)}`)
    .join("\n");
  const total = cartTotal() || 30000;
  return `Cuciin — Nota laundry
${c.name}
${c.address}
WA ${c.phone}

${lines}

Total    ${Rp(total)}
Dibayar  ${Rp(state.paid)}
Sisa     ${Rp(Math.max(total - state.paid, 0))}
Bayar    ${methodLabel()} · ${st.label}
Janji    ${state.promise}${state.cart.some((i) => i.dropOut) ? "\nDrop Out — tidak perlu nunggu" : ""}`;
}

function siapText(order) {
  const o = order || activeQueue();
  return `Cuciin — cucian siap diambil
Hai ${o.customer}, cucian ${o.id} sudah siap.
${o.items}
Ambil di Cuciin, Jl. Laundry Raya 1.
Janji ${o.promise}.`;
}

function personInitials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function activeQueue() {
  return state.queue.find((q) => q.id === state.activeQueueId) || state.queue[0];
}

function registerRoles() {
  return state.roles.filter((r) => !r.owner);
}

function go(screen) {
  state.screen = screen;
  state.loggedIn = !AUTH.includes(screen);
  render();
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
    return ["home", "kasir", "customers", "customer-form", "pick-customer", "bayar", "nota", "wa-chat", "wa-ready", "orders", "pelunasan", "inventory", "stok-masuk", "tutup-kas", "queue-detail"].includes(id);
  }
  if (state.role === "supervisor") {
    return ["home", "queue-detail", "wa-ready", "inventory"].includes(id);
  }
  return false;
}

function backBtn(to) {
  return `<button class="icon-btn" data-go="${to}" aria-label="Kembali">←</button>`;
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
  return `<div class="steps">${PIPE.map((p) => {
    const idx = PIPE.findIndex((x) => x.id === current);
    const i = PIPE.findIndex((x) => x.id === p.id);
    const cls = i < idx ? "done" : i === idx ? "on" : "";
    return `<span class="${cls}">${p.label}</span>`;
  }).join("")}</div>`;
}

function queueCard(o) {
  const pay = payStatus(o.paid, o.total);
  const pipe = pipeMeta(o.pipe);
  return `<button class="card tap" data-open-queue="${o.id}">
    <div class="row">
      <div class="grow">
        <div class="name">${o.id} · ${o.customer}</div>
        <div class="meta">${o.items} · janji ${o.promise}</div>
      </div>
    </div>
    <div class="chip-row">
      ${chipStatus(pay.id, pay.label)}
      ${chipStatus("pipe", pipe.label)}
      ${o.dropOut ? '<span class="chip do">Drop Out</span>' : ""}
      ${o.late ? '<span class="chip belum">Telat</span>' : ""}
    </div>
  </button>`;
}

function screenLogin() {
  return `<div class="login">
    <div class="mark">Ci</div>
    <h1>Cuciin</h1>
    <p class="lede">Kasir dan SPV daftar dulu. Owner yang nyalain akses.</p>
    ${authTabs("login")}
    <label class="form"><span>Email</span><input value="${state.role === "owner" ? state.ownerEmail : "rina@cuciin.id"}" /></label>
    <label class="form"><span>Password</span><input type="password" value="••••••••" /></label>
    <button class="btn primary" data-go="home">Masuk</button>
  </div>`;
}

function screenRegister() {
  const roles = registerRoles();
  return `<div class="login">
    <div class="mark">Ci</div>
    <h1>Daftar</h1>
    <p class="lede">Pilih role. Kalau Owner bikin role baru, muncul di sini juga.</p>
    ${authTabs("register")}
    <label class="form"><span>Nama</span><input value="Fajar Putra" /></label>
    <label class="form"><span>Email</span><input value="fajar@cuciin.id" /></label>
    <label class="form"><span>Password</span><input type="password" value="••••••••" /></label>
    <label class="form"><span>Daftar sebagai</span>
      <select id="reg-role">
        ${roles.map((r) => `<option ${r.name === "Kasir" ? "selected" : ""}>${r.name}</option>`).join("")}
      </select>
    </label>
    <button class="btn primary" data-register>Kirim pendaftaran</button>
  </div>`;
}

function screenPending() {
  return `<div class="login">
    <div class="mark">Ci</div>
    <h1>Nunggu Owner</h1>
    <p class="lede">Akun Kasir lo sudah masuk. Belum bisa buka antrian atau kasir sebelum Tiftazani setujui.</p>
    <div class="card"><div class="name">Fajar Putra</div><div class="meta">Kasir · menunggu persetujuan</div></div>
    <button class="btn ghost" data-go="login">Kembali ke masuk</button>
  </div>`;
}

function screenRejected() {
  return `<div class="login">
    <h1>Ditolak</h1>
    <p class="lede">Owner belum kasih akses. Hubungi Tiftazani.</p>
    <button class="btn primary" data-go="login">Ke halaman masuk</button>
  </div>`;
}

function screenHome() {
  const pending = state.users.filter((u) => u.status === "pending").length;
  const aktif = state.queue.filter((q) => q.pipe !== "diambil");
  const doCount = aktif.filter((q) => q.dropOut).length;
  const late = aktif.filter((q) => q.late).length;

  if (state.role === "supervisor") {
    const list = state.queueFilter === "do" ? aktif.filter((q) => q.dropOut) : aktif;
    return `<div class="screen has-fab">
      <div class="top"><div><p class="sub">Supervisor · lantai</p><h1>Antrian</h1></div></div>
      <div class="stats">
        <div class="stat"><div class="k">Drop Out</div><div class="v">${doCount}</div></div>
        <div class="stat"><div class="k">Telat janji</div><div class="v">${late}</div></div>
        <div class="stat"><div class="k">Stok out</div><div class="v">9</div></div>
      </div>
      <div class="segment tight">
        <button class="${state.queueFilter === "aktif" ? "on" : ""}" data-qfilter="aktif">Aktif</button>
        <button class="${state.queueFilter === "do" ? "on" : ""}" data-qfilter="do">Drop Out</button>
      </div>
      ${list.map(queueCard).join("")}
    </div>`;
  }

  return `<div class="screen has-fab">
    <div class="top">
      <div>
        <p class="sub">Halo, ${state.role === "owner" ? "Tiftazani" : "Rina"}</p>
        <h1>Antrian</h1>
      </div>
    </div>
    ${
      state.role === "owner"
        ? `<button class="card tap" data-go="laporan"><div class="name">Laporan mingguan & bulanan</div><div class="meta">Export Excel atau PDF</div></button>`
        : ""
    }
    ${
      state.role === "owner" && pending
        ? `<button class="card tap warn" data-go="users"><div class="name">${pending} pengajuan akun</div><div class="meta">Setujui Kasir / SPV / role baru</div></button>`
        : ""
    }
    ${
      state.role !== "supervisor"
        ? `<div class="hero">
            <div class="k">Omzet hari ini</div>
            <div class="v">${Rp(1284000)}</div>
            <div class="hero-row">
              <span class="pill">${aktif.length} antrian</span>
              <span class="pill">${doCount} Drop Out</span>
              <span class="pill">${late} telat</span>
            </div>
          </div>`
        : ""
    }
    <div class="section-label">Hari ini <span>geser status, bukan nambah nota</span></div>
    ${aktif.map(queueCard).join("")}
    ${state.role === "kasir" || state.role === "owner" ? `<button class="btn ghost" data-go="tutup-kas">Tutup kas shift ini</button>` : ""}
    ${state.role !== "supervisor" ? `<button class="fab" data-go="kasir">+ Nota baru</button>` : ""}
  </div>`;
}

function screenCustomers() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Nama · alamat · HP</p><h1>Pelanggan</h1></div></div>
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
    <div class="top">${backBtn("customers")}<h1>Pelanggan baru</h1><span></span></div>
    <label class="form"><span>Nama</span><input placeholder="Nama lengkap" /></label>
    <label class="form"><span>Alamat</span><textarea rows="2" placeholder="Alamat"></textarea></label>
    <label class="form"><span>No. HP / WhatsApp</span><input placeholder="08xxxxxxxxxx" /></label>
    <button class="btn primary" data-toast="Pelanggan tersimpan" data-go="customers">Simpan</button>
  </div>`;
}

function screenKasir() {
  const c = state.customer;
  return `<div class="screen">
    <div class="top"><div><p class="sub">Satu nota, satu jalur</p><h1>Nota baru</h1></div></div>
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
    <div class="section-label">Layanan kami <span>ikon per jenis</span></div>
    <div class="grid-svc">
      ${SERVICES.map(svcTile).join("")}
    </div>
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
  const st = payStatus(paid, total);
  const sisa = Math.max(total - paid, 0);
  return `<div class="screen">
    <div class="top">${backBtn("kasir")}<h1>Janji & bayar</h1><span></span></div>
    <div class="pay-box">
      <p class="sub">Total nota</p>
      <div class="total">${Rp(total)}</div>
      ${chipStatus(st.id, st.label)}
    </div>
    <label class="form"><span>Janji selesai</span><input value="${state.promise}" /></label>
    <p class="section-label">Metode</p>
    <div class="methods">
      ${["tunai", "qris", "transfer"].map((m) => `<button class="${state.payMethod === m ? "on" : ""}" data-method="${m}">${{ tunai: "Tunai", qris: "QRIS", transfer: "Transfer" }[m]}</button>`).join("")}
    </div>
    <label class="form"><span>Dibayar sekarang</span><input id="paid-input" inputmode="numeric" value="${paid}" /></label>
    <div class="pay-quick">
      <button data-paid="0">0</button>
      <button data-paid="${Math.round(total / 2)}">DP setengah</button>
      <button data-paid="${total}">Lunas</button>
    </div>
    <p class="sisa">Sisa tagihan <b>${Rp(sisa)}</b></p>
    <button class="btn primary" data-go="nota">Simpan & WA nota</button>
  </div>`;
}

function screenNota() {
  const c = state.customer;
  return `<div class="screen">
    <div class="top">${backBtn("bayar")}<h1>Kirim nota</h1><span></span></div>
    <p class="meta" style="margin-bottom:10px">WhatsApp ke ${c.phone}</p>
    <div class="nota">${notaText()}</div>
    <button class="btn wa" data-wa="nota">Kirim WhatsApp</button>
    <button class="btn ghost" data-go="home">Masuk antrian, WA nanti</button>
  </div>`;
}

function waScreen(kind) {
  const c = kind === "siap" ? { name: activeQueue().customer, phone: activeQueue().phone, initials: personInitials(activeQueue().customer) } : state.customer;
  const body = kind === "siap" ? siapText() : notaText();
  const back = kind === "siap" ? "queue-detail" : "nota";
  const doneGo = kind === "siap" ? "home" : "home";
  return `<div class="screen" style="padding:0">
    <div class="wa-app">
      <div class="wa-head">
        ${backBtn(back)}
        <div class="avatar">${c.initials || "WA"}</div>
        <div class="grow">
          <div class="name">${c.name}</div>
          <div class="meta">${c.phone} · WhatsApp</div>
        </div>
      </div>
      ${state.waSent ? `<div class="wa-sent-banner">${kind === "siap" ? "Siap ambil terkirim" : "Nota terkirim"} · ${c.phone}</div>` : ""}
      <div class="wa-thread">
        <div class="wa-bubble">${body}<div class="wa-time">${state.waSent ? "09.41 ✓✓" : "draft"}</div></div>
      </div>
      ${
        state.waSent
          ? `<button class="btn primary" style="margin:0 12px 16px;width:auto" data-go="${doneGo}">${kind === "siap" ? "Kembali ke antrian" : "Lanjut ke antrian"}</button>`
          : `<div class="wa-composer"><p class="hint">${kind === "siap" ? "Siap diambil" : "Nota"} siap dikirim</p>
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

function screenQueueDetail() {
  const o = activeQueue();
  const pipe = pipeMeta(o.pipe);
  const pay = payStatus(o.paid, o.total);
  return `<div class="screen">
    <div class="top">${backBtn("home")}<h1>${o.id}</h1><span></span></div>
    <div class="card">
      <div class="name">${o.customer}</div>
      <div class="meta">${o.phone}</div>
      <div class="meta">${o.items}</div>
      <div class="chip-row">${chipStatus(pay.id, pay.label)} ${o.dropOut ? '<span class="chip do">Drop Out</span>' : ""}</div>
      <div class="meta">Janji ${o.promise}</div>
    </div>
    <p class="section-label">Progres cucian</p>
    ${stepper(o.pipe)}
    ${
      o.pipe === "diambil"
        ? `<p class="empty">Sudah diambil.</p>`
        : o.pipe === "siap"
          ? `<button class="btn wa" data-wa="siap">WA siap diambil</button>
             <button class="btn primary" data-mark-taken>Tandai sudah diambil</button>`
          : `<button class="btn primary" data-advance-pipe>Lanjut: ${pipeMeta(pipe.next).label}</button>`
    }
  </div>`;
}

function screenOrders() {
  const q = state.searchQ.toLowerCase();
  const rows = state.queue.filter((o) => !q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.phone.includes(q));
  return `<div class="screen">
    <div class="top"><div><p class="sub">Nomor · nama · HP</p><h1>Cari nota</h1></div></div>
    <input class="search" id="nota-search" placeholder="CU-2401… atau nama" value="${state.searchQ}" />
    ${rows.map(queueCard).join("") || `<p class="empty">Tidak ketemu</p>`}
  </div>`;
}

function screenPelunasan() {
  const o = state.payTarget || state.orders[0];
  const sisa = o.total - o.paid;
  return `<div class="screen">
    <div class="top">${backBtn("orders")}<h1>Pelunasan</h1><span></span></div>
    <div class="card">
      <div class="name">${o.id} · ${o.customer}</div>
      <p class="sisa">Sisa tagihan <b>${Rp(sisa)}</b></p>
    </div>
    <label class="form"><span>Bayar tambahan</span><input value="${sisa}" /></label>
    <button class="btn wa" data-toast="Update sisa dikirim WA" data-go="orders">Bayar & kirim WA</button>
  </div>`;
}

function screenLayanan() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Tambah / hapus</p><h1>Layanan</h1></div></div>
      ${SERVICES.map((s) => {
        const ico = SVC_ICON[s.id] || SVC_ICON.cuci;
        return `<button class="card tap" data-go="layanan-form">
        <div class="row">
          <div class="svc-ico" style="background:${ico.bg}">${ico.svg}</div>
          <div class="grow">
            <div class="name">${s.name} ${s.dropOut ? '<span class="chip do">Drop Out</span>' : ""}</div>
            <div class="meta">${s.desc}</div>
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
    <div class="top">${backBtn("layanan")}<h1>Layanan</h1><span></span></div>
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
  const totalIn = state.products.reduce((s, p) => s + p.in, 0);
  const totalOut = state.products.reduce((s, p) => s + p.out, 0);
  return `<div class="screen">
    <div class="top"><div><p class="sub">Retail</p><h1>Stok</h1></div></div>
    <div class="stats">
      <div class="stat"><div class="k">Masuk</div><div class="v">${totalIn}</div></div>
      <div class="stat"><div class="k">Keluar</div><div class="v">${totalOut}</div></div>
      <div class="stat"><div class="k">Item</div><div class="v">${state.products.length}</div></div>
    </div>
    ${state.products.map((p) => `
      <div class="card">
        <div class="name">${p.name} ${p.stock <= p.min ? '<span class="chip belum">Rendah</span>' : ""}</div>
        <div class="meta">Sisa ${p.stock} · masuk ${p.in} · keluar ${p.out}</div>
      </div>`).join("")}
    ${state.role !== "supervisor" ? `<button class="fab" data-go="stok-masuk">+ Stok masuk</button>` : ""}
  </div>`;
}

function screenStokMasuk() {
  return `<div class="screen">
    <div class="top">${backBtn("inventory")}<h1>Stok masuk</h1><span></span></div>
    <label class="form"><span>Produk</span>
      <select><option>Sabun</option><option>Softener</option><option>Parfum uk 100</option></select>
    </label>
    <label class="form"><span>Jumlah</span><input value="12" /></label>
    <button class="btn primary" data-toast="Stok masuk tercatat" data-go="inventory">Simpan</button>
  </div>`;
}

function screenUsers() {
  const list = state.users.filter((u) => (state.userFilter === "pengajuan" ? u.status === "pending" : u.status === "approved"));
  return `<div class="screen">
    <div class="top"><div><p class="sub">Owner yang nyalain</p><h1>User</h1></div></div>
    <div class="segment tight">
      <button class="${state.userFilter === "pengajuan" ? "on" : ""}" data-ufilter="pengajuan">Pengajuan</button>
      <button class="${state.userFilter === "aktif" ? "on" : ""}" data-ufilter="aktif">Aktif</button>
    </div>
    ${list.map((u) => `
      <div class="card">
        <div class="name">${u.name}</div>
        <div class="meta">${u.role} · ${u.status}</div>
        ${u.status === "pending" ? `<div class="row-actions">
          <button class="btn primary" data-approve="${u.name}">Setujui</button>
          <button class="btn danger" data-reject="${u.name}">Tolak</button>
        </div>` : ""}
      </div>`).join("") || `<p class="empty">Kosong</p>`}
  </div>`;
}

function screenRoles() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Role baru ikut dropdown Daftar</p><h1>Role</h1></div></div>
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

function screenProfil() {
  return `<div class="screen">
    <div class="top">${backBtn("more")}<h1>Profil usaha</h1><span></span></div>
    <label class="form"><span>Nama laundry</span><input value="Cuciin" /></label>
    <label class="form"><span>Alamat</span><textarea rows="2">Jl. Laundry Raya 1, Bandung</textarea></label>
    <label class="form"><span>Email Owner</span><input id="owner-email" value="${state.ownerEmail}" /></label>
    <p class="meta" style="margin-bottom:12px">Bisa diubah. Default awal: tiftazani.khara@gmail.com</p>
    <button class="btn ghost" data-toast="Permintaan hapus akun (syarat Play)">Hapus akun saya</button>
    <button class="btn primary" data-save-profil>Simpan</button>
  </div>`;
}

function reportData() {
  return state.reportPeriod === "minggu"
    ? { label: "Minggu ini · 4–10 Sep", omzet: 3210000, nota: 18, dropOut: 12, piutang: 54000, bars: [40, 55, 35, 70, 90, 60, 78] }
    : { label: "September 2026", omzet: 12840000, nota: 86, dropOut: 48, piutang: 186000, bars: [30, 45, 50, 62, 80, 70, 88, 75] };
}

function screenLaporan() {
  const r = reportData();
  return `<div class="screen">
    <div class="top">${backBtn("more")}<h1>Laporan</h1><span></span></div>
    <div class="segment tight">
      <button class="${state.reportPeriod === "minggu" ? "on" : ""}" data-rperiod="minggu">Mingguan</button>
      <button class="${state.reportPeriod === "bulan" ? "on" : ""}" data-rperiod="bulan">Bulanan</button>
    </div>
    <p class="meta" style="margin-bottom:10px">${r.label} · ${state.ownerEmail}</p>
    <div class="hero">
      <div class="k">Omzet</div>
      <div class="v">${Rp(r.omzet)}</div>
      <div class="hero-row">
        <span class="pill">${r.nota} nota</span>
        <span class="pill">${r.dropOut} Drop Out</span>
        <span class="pill">Piutang ${Rp(r.piutang)}</span>
      </div>
    </div>
    <div class="card">
      <div class="name">Tren</div>
      <div class="bars">${r.bars.map((h) => `<i style="height:${h}%"></i>`).join("")}</div>
    </div>
    <div class="card">
      <div class="cart-item"><span>Cuci</span><b>${Rp(Math.round(r.omzet * 0.32))}</b></div>
      <div class="cart-item"><span>Curing / DO</span><b>${Rp(Math.round(r.omzet * 0.48))}</b></div>
      <div class="cart-item"><span>Retail</span><b>${Rp(Math.round(r.omzet * 0.2))}</b></div>
    </div>
    <button class="btn primary" data-export="xlsx">Export Excel</button>
    <button class="btn ghost" data-export="pdf">Export PDF</button>
  </div>`;
}

function screenTutupKas() {
  return `<div class="screen">
    <div class="top">${backBtn("home")}<h1>Tutup kas</h1><span></span></div>
    <p class="meta" style="margin-bottom:12px">Shift Rina · 10 Sep 2026</p>
    <div class="card">
      <div class="cart-item"><span>Modal awal</span><b>${Rp(300000)}</b></div>
      <div class="cart-item"><span>Tunai sistem</span><b>${Rp(420000)}</b></div>
      <div class="cart-item"><span>QRIS</span><b>${Rp(185000)}</b></div>
      <div class="cart-item"><span>Transfer</span><b>${Rp(90000)}</b></div>
      <div class="cart-item"><span>Piutang / DP</span><b>${Rp(54000)}</b></div>
    </div>
    <label class="form"><span>Tunai di laci (hitung)</span><input value="420000" /></label>
    <p class="sisa">Selisih <b>Rp 0</b></p>
    <button class="btn primary" data-toast="Kas ditutup" data-go="home">Tutup shift</button>
  </div>`;
}

function screenMore() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Owner</p><h1>Lainnya</h1></div></div>
    <div class="menu-list">
      <button data-go="laporan">Laporan (Excel / PDF) <span>›</span></button>
      <button data-go="orders">Cari nota <span>›</span></button>
      <button data-go="tutup-kas">Tutup kas <span>›</span></button>
      <button data-go="layanan">Layanan <span>›</span></button>
      <button data-go="users">User & pengajuan <span>›</span></button>
      <button data-go="roles">Role & akses <span>›</span></button>
      <button data-go="profil">Profil & hapus akun <span>›</span></button>
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
  "queue-detail": screenQueueDetail,
  orders: screenOrders,
  pelunasan: screenPelunasan,
  layanan: screenLayanan,
  "layanan-form": screenLayananForm,
  inventory: screenInventory,
  "stok-masuk": screenStokMasuk,
  users: screenUsers,
  roles: screenRoles,
  profil: screenProfil,
  laporan: screenLaporan,
  "tutup-kas": screenTutupKas,
  more: screenMore,
};

function qtySheet() {
  if (!state.sheet) return "";
  const s = SERVICES.find((x) => x.id === state.sheet);
  return `<div class="sheet-bg" data-close-sheet>
    <div class="sheet" data-stop>
      <div class="grab"></div>
      ${(SVC_ICON[s.id] ? `<div class="svc-ico" style="background:${SVC_ICON[s.id].bg};margin:0 auto 8px">${SVC_ICON[s.id].svg}</div>` : "")}
      <h2>${s.name}</h2>
      <p class="meta">${s.desc} · ${Rp(s.price)} / ${s.unit}</p>
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
    ["bayar", "nota", "customer-form", "layanan-form", "pelunasan", "stok-masuk", "profil", "wa-chat", "wa-ready", "queue-detail", "tutup-kas", "laporan"].includes(state.screen);
  bar.hidden = hide;
  if (hide) {
    bar.innerHTML = "";
    return;
  }
  const tabs = TABS[state.role] || TABS.kasir;
  const active = tabs.some((t) => t.id === state.screen) ? state.screen : "";
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

document.getElementById("role-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-role]");
  if (!btn) return;
  state.role = btn.dataset.role;
  [...document.getElementById("role-switch").children].forEach((b) => b.classList.toggle("on", b === btn));
  if (state.loggedIn) {
    state.screen = "home";
    state.sheet = null;
  }
  render();
});

document.body.addEventListener("click", (e) => {
  const jump = e.target.closest("[data-jump]");
  if (jump) {
    const id = jump.dataset.jump;
    if (!navAllowed(id) && !AUTH.includes(id)) {
      showToast("Role ini nggak punya modul itu");
      return;
    }
    state.screen = id;
    state.loggedIn = !AUTH.includes(id);
    render();
    return;
  }

  if (e.target.closest("[data-register]")) {
    const sel = document.getElementById("reg-role");
    const roleName = sel ? sel.value : "Kasir";
    if (!state.users.some((u) => u.name === "Fajar Putra" && u.status === "pending")) {
      state.users.push({ name: "Fajar Putra", role: roleName, status: "pending" });
    } else {
      state.users.find((u) => u.name === "Fajar Putra").role = roleName;
    }
    go("pending");
    return;
  }

  if (e.target.closest("[data-add-role]")) {
    const input = document.getElementById("new-role-name");
    const name = (input && input.value.trim()) || "Setrika";
    if (!state.roles.some((r) => r.name === name)) {
      state.roles.push({ name, modules: ["dashboard"] });
    }
    showToast(`Role ${name} muncul di form Daftar`);
    return;
  }

  const rp = e.target.closest("[data-rperiod]");
  if (rp) {
    state.reportPeriod = rp.dataset.rperiod;
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

  const exp = e.target.closest("[data-export]");
  if (exp) {
    const r = reportData();
    const period = state.reportPeriod;
    if (exp.dataset.export === "xlsx") {
      const csv = `Laporan Cuciin,${r.label}\nOwner,${state.ownerEmail}\nOmzet,${r.omzet}\nNota,${r.nota}\nDrop Out,${r.dropOut}\nPiutang,${r.piutang}\n`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
      a.download = `laporan-cuciin-${period}.csv`;
      a.click();
      showToast("Excel (CSV) terunduh");
    } else {
      const html = `<html><head><title>Laporan Cuciin</title></head><body style="font-family:sans-serif;padding:24px"><h1>Cuciin</h1><p>${r.label}<br>${state.ownerEmail}</p><p>Omzet ${Rp(r.omzet)}</p><p>Nota ${r.nota} · Drop Out ${r.dropOut}</p><p>Piutang ${Rp(r.piutang)}</p><p>Print → Save as PDF</p></body></html>`;
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
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
    go("queue-detail");
    return;
  }

  if (e.target.closest("[data-advance-pipe]")) {
    const o = activeQueue();
    const next = pipeMeta(o.pipe).next;
    if (next) o.pipe = next;
    if (next === "siap") {
      state.waKind = "siap";
      state.waSent = false;
      go("wa-ready");
      return;
    }
    render();
    return;
  }

  if (e.target.closest("[data-mark-taken]")) {
    activeQueue().pipe = "diambil";
    showToast("Sudah diambil");
    go("home");
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
    const o = state.orders.find((x) => x.id === order.dataset.openOrder);
    state.payTarget = o;
    if (o.paid >= o.total) {
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
    state.waSent = true;
    if (state.waKind === "nota" && state.cart.length) {
      const id = "CU-2401-0043";
      if (!state.queue.some((q) => q.id === id)) {
        state.queue.unshift({
          id,
          customer: state.customer.name,
          phone: state.customer.phone,
          items: state.cart.map((i) => `${i.name} ${i.qty}${i.unit}`).join(", "),
          total: cartTotal(),
          paid: state.paid,
          pay: payStatus(state.paid, cartTotal()).id,
          pipe: "diterima",
          dropOut: state.cart.some((i) => i.dropOut),
          promise: state.promise,
          late: false,
        });
        state.activeQueueId = id;
      }
    }
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
    const st = payStatus(state.paid, total);
    const sisa = Math.max(total - state.paid, 0);
    document.querySelector(".pay-box .chip")?.replaceWith(
      Object.assign(document.createElement("span"), { className: `chip ${st.id}`, textContent: st.label })
    );
    const sisaEl = document.querySelector(".sisa");
    if (sisaEl) sisaEl.innerHTML = `Sisa tagihan <b>${Rp(sisa)}</b>`;
  }
  if (e.target.id === "nota-search") {
    state.searchQ = e.target.value;
  }
});

applyUrl();
render();
