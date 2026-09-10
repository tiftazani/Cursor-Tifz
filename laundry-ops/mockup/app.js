const Rp = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");

const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1z"/></svg>`,
  kasir: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M4 19a5 5 0 0 1 10 0"/><circle cx="17" cy="9" r="2"/><path d="M20 19a4 4 0 0 0-4-4"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8 12 4l9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>`,
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
  { id: "c1", name: "Siti Rahma", address: "Jl. Melati 12, Bandung", phone: "0812-3301-8890", initials: "SR" },
  { id: "c2", name: "Budi Santoso", address: "Komplek Cempaka Blok B2", phone: "0857-1120-4455", initials: "BS" },
  { id: "c3", name: "Dewi Lestari", address: "Jl. Anggrek No. 8", phone: "0813-7788-2210", initials: "DL" },
];

const MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pelanggan", label: "Pelanggan" },
  { id: "transaksi", label: "Transaksi" },
  { id: "layanan", label: "Layanan" },
  { id: "inventory", label: "Inventory" },
  { id: "user", label: "User" },
  { id: "role", label: "Role & akses" },
  { id: "profil", label: "Profil usaha" },
];

const state = {
  role: "owner",
  screen: "login",
  loggedIn: false,
  customer: CUSTOMERS[0],
  cart: [],
  sheet: null,
  qtyDraft: 1,
  paid: 0,
  toast: "",
  orders: [
    { id: "N-1042", customer: "Siti Rahma", total: 85000, paid: 85000, status: "lunas", dropOut: true },
    { id: "N-1041", customer: "Budi Santoso", total: 54000, paid: 20000, status: "dp", dropOut: false },
    { id: "N-1040", customer: "Dewi Lestari", total: 28000, paid: 0, status: "belum", dropOut: true },
  ],
  payTarget: null,
  extraPay: 0,
  waSent: false,
  layananEdit: null,
  stockInProduct: "Sabun",
  products: [
    { name: "Sabun", stock: 24, in: 10, out: 4 },
    { name: "Softener", stock: 18, in: 8, out: 3 },
    { name: "Parfum uk 100", stock: 9, in: 5, out: 2 },
  ],
  roles: [
    { name: "Owner", modules: MODULES.map((m) => m.id) },
    { name: "Kasir", modules: ["dashboard", "pelanggan", "transaksi", "inventory"] },
    { name: "Supervisor", modules: ["dashboard"] },
  ],
  users: [
    { name: "Tiftazani", role: "Owner" },
    { name: "Rina", role: "Kasir" },
    { name: "Andi", role: "Supervisor" },
  ],
};

const TABS = {
  owner: [
    { id: "home", label: "Beranda", icon: "home" },
    { id: "kasir", label: "Kasir", icon: "kasir" },
    { id: "customers", label: "Pelanggan", icon: "people" },
    { id: "inventory", label: "Stok", icon: "box" },
    { id: "more", label: "Lainnya", icon: "more" },
  ],
  kasir: [
    { id: "home", label: "Beranda", icon: "home" },
    { id: "kasir", label: "Kasir", icon: "kasir" },
    { id: "customers", label: "Pelanggan", icon: "people" },
    { id: "inventory", label: "Stok", icon: "box" },
  ],
  supervisor: [{ id: "home", label: "Beranda", icon: "home" }],
};

const JUMPS = [
  { id: "login", label: "Login" },
  { id: "home", label: "Dashboard" },
  { id: "customers", label: "Pelanggan" },
  { id: "customer-form", label: "Form pelanggan" },
  { id: "kasir", label: "Kasir" },
  { id: "bayar", label: "Bayar" },
  { id: "nota", label: "Nota + WA" },
  { id: "orders", label: "Daftar nota" },
  { id: "pelunasan", label: "Pelunasan" },
  { id: "layanan", label: "Layanan" },
  { id: "layanan-form", label: "Form layanan" },
  { id: "inventory", label: "Inventory" },
  { id: "stok-masuk", label: "Stok masuk" },
  { id: "users", label: "User" },
  { id: "roles", label: "Role" },
  { id: "profil", label: "Profil usaha" },
  { id: "wa-chat", label: "WhatsApp" },
];

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function cartTotal() {
  return state.cart.reduce((s, i) => s + i.qty * i.price, 0);
}

function payStatus(paid, total) {
  if (paid <= 0) return { id: "belum", label: "Belum lunas" };
  if (paid < total) return { id: "dp", label: "DP" };
  return { id: "lunas", label: "Lunas" };
}

function waNumber(phone) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) return "62" + d.slice(1);
  return d;
}

function notaText() {
  const c = state.customer;
  const st = payStatus(state.paid, cartTotal());
  const lines = state.cart
    .map((i) => `• ${i.name} ${i.qty} ${i.unit} x ${Rp(i.price)} = ${Rp(i.qty * i.price)}`)
    .join("\n");
  return `Cuciin — Nota laundry
${c.name}
${c.address}
WA ${c.phone}

${lines}

Total   ${Rp(cartTotal())}
Dibayar ${Rp(state.paid)}
Sisa    ${Rp(Math.max(cartTotal() - state.paid, 0))}
Status  ${st.label}${state.cart.some((i) => i.dropOut) ? "\nDrop Out — tidak perlu nunggu" : ""}`;
}

function go(screen) {
  state.screen = screen;
  if (screen !== "login") state.loggedIn = true;
  if (screen === "login") state.loggedIn = false;
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
    state.loggedIn = screen !== "login";
  }
  if ((state.screen === "bayar" || state.screen === "nota") && !state.cart.length) {
    state.cart = [{ ...SERVICES[2], qty: 3 }];
    state.paid = state.screen === "nota" ? 15000 : 0;
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
  const tabs = TABS[state.role].map((t) => t.id);
  if (tabs.includes(id)) return true;
  if (state.role === "owner") return true;
  if (state.role === "kasir" && ["customer-form", "bayar", "nota", "orders", "pelunasan", "stok-masuk"].includes(id)) return true;
  if (state.role === "supervisor") return id === "home";
  return false;
}

function backBtn(to) {
  return `<button class="icon-btn" data-go="${to}" aria-label="Kembali">←</button>`;
}

function chipStatus(id, label) {
  return `<span class="chip ${id}">${label}</span>`;
}

function screenLogin() {
  return `<div class="login">
    <div class="mark">Ci</div>
    <h1>Cuciin</h1>
    <p class="lede">Masuk sesuai akun. Menu menyesuaikan role lo.</p>
    <label class="form"><span>Email</span><input value="owner@cuciin.id" /></label>
    <label class="form"><span>Password</span><input type="password" value="••••••••" /></label>
    <button class="btn primary" data-go="home">Masuk</button>
  </div>`;
}

function screenHome() {
  if (state.role === "supervisor") {
    return `<div class="screen">
      <div class="top"><div><p class="sub">Hari ini · Supervisor</p><h1>Drop Out</h1></div></div>
      <div class="stats big">
        <div class="stat"><div class="k">Jumlah Drop Out</div><div class="v">12</div><p class="meta">Nota yang dikerjain penjaga, pelanggan tidak nunggu</p></div>
        <div class="stat"><div class="k">Stok masuk</div><div class="v">23</div><p class="meta">Sabun, softener, parfum</p></div>
        <div class="stat"><div class="k">Stok keluar</div><div class="v">9</div><p class="meta">Terjual dari kasir hari ini</p></div>
      </div>
    </div>`;
  }
  return `<div class="screen">
    <div class="top">
      <div>
        <p class="sub">Halo, ${state.role === "owner" ? "Tiftazani" : "Rina"}</p>
        <h1>Beranda</h1>
      </div>
    </div>
    <div class="hero">
      <div class="k">Omzet hari ini</div>
      <div class="v">${Rp(1284000)}</div>
      <div class="hero-row">
        <span class="pill">18 nota</span>
        <span class="pill">12 Drop Out</span>
        <span class="pill">4 masih DP</span>
      </div>
    </div>
    <div class="section-label">Pelanggan <span>nama · alamat · HP</span></div>
    ${CUSTOMERS.map((c) => `
      <button class="card tap" data-pick-customer="${c.id}" data-go="kasir">
        <div class="row">
          <div class="avatar">${c.initials}</div>
          <div class="grow">
            <div class="name">${c.name}</div>
            <div class="meta">${c.address}</div>
            <div class="meta">${c.phone}</div>
          </div>
        </div>
      </button>`).join("")}
  </div>`;
}

function screenCustomers() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Master data</p><h1>Pelanggan</h1></div></div>
    <input class="search" placeholder="Cari nama atau HP" />
    ${CUSTOMERS.map((c) => `
      <div class="card">
        <div class="row">
          <div class="avatar">${c.initials}</div>
          <div class="grow">
            <div class="name">${c.name}</div>
            <div class="meta">${c.address}</div>
            <div class="meta">${c.phone} · WhatsApp ke nomor ini</div>
          </div>
        </div>
      </div>`).join("")}
    <button class="fab" data-go="customer-form">+ Pelanggan</button>
  </div>`;
}

function screenCustomerForm() {
  return `<div class="screen">
    <div class="top">${backBtn("customers")}<h1>Pelanggan baru</h1><span></span></div>
    <label class="form"><span>Nama</span><input placeholder="Nama lengkap" /></label>
    <label class="form"><span>Alamat</span><textarea rows="2" placeholder="Alamat antar/jemput"></textarea></label>
    <label class="form"><span>No. HP / WhatsApp</span><input placeholder="08xxxxxxxxxx" /></label>
    <button class="btn primary" data-toast="Pelanggan tersimpan" data-go="customers">Simpan</button>
  </div>`;
}

function screenKasir() {
  const c = state.customer;
  return `<div class="screen">
    <div class="top"><div><p class="sub">Nota baru</p><h1>Kasir</h1></div></div>
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
    <div class="section-label">Layanan <span>kiloan atau satuan</span></div>
    <div class="grid-svc">
      ${SERVICES.map((s) => `
        <button class="svc" data-open-qty="${s.id}">
          <div class="t">${s.name}</div>
          <div class="d">${s.desc}</div>
          <div class="p">${Rp(s.price)} / ${s.unit} ${s.dropOut ? '<span class="chip do">Drop Out</span>' : ""}</div>
        </button>`).join("")}
    </div>
    <div class="cart dock">
      ${
        state.cart.length
          ? state.cart.map((i) => `<div class="cart-item"><span>${i.name} · ${i.qty} ${i.unit}</span><b>${Rp(i.qty * i.price)}</b></div>`).join("") +
            `<div class="cart-item"><span>Total</span><b>${Rp(cartTotal())}</b></div>
             <button class="btn primary" data-go="bayar">Lanjut bayar</button>`
          : `<p class="empty" style="padding:8px">Tap layanan. Qty kg atau pcs sesuai tarif.</p>`
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
    <div class="top">${backBtn("kasir")}<h1>Bayar</h1><span></span></div>
    <div class="pay-box">
      <p class="sub">Total nota</p>
      <div class="total">${Rp(total)}</div>
      ${chipStatus(st.id, st.label)}
    </div>
    <label class="form"><span>Dibayar sekarang</span><input id="paid-input" inputmode="numeric" value="${paid}" /></label>
    <div class="pay-quick">
      <button data-paid="0">0</button>
      <button data-paid="${Math.round(total / 2)}">Setengah</button>
      <button data-paid="${total}">Lunas</button>
    </div>
    <p class="sisa">Sisa tagihan <b>${Rp(sisa)}</b> · ${st.id === "dp" ? "uang muka, pelunasan nanti" : st.id === "belum" ? "belum ada bayaran" : "sudah nutup"}</p>
    <button class="btn primary" data-go="nota">Simpan nota</button>
  </div>`;
}

function screenNota() {
  const c = state.customer;
  const wa = waNumber(c.phone);
  return `<div class="screen">
    <div class="top">${backBtn("bayar")}<h1>Kirim nota</h1><span></span></div>
    <p class="meta" style="margin-bottom:10px">WhatsApp ke ${c.phone} · wa.me/${wa}</p>
    <div class="nota">${notaText()}</div>
    <button class="btn wa" data-wa="${wa}">Kirim WhatsApp</button>
    <button class="btn ghost" data-go="orders">Simpan, kirim nanti</button>
  </div>`;
}

function screenWaChat() {
  const c = state.customer;
  return `<div class="screen" style="padding:0">
    <div class="wa-app">
      <div class="wa-head">
        ${backBtn("nota")}
        <div class="avatar">${c.initials}</div>
        <div class="grow">
          <div class="name">${c.name}</div>
          <div class="meta">${c.phone} · WhatsApp</div>
        </div>
      </div>
      ${state.waSent ? `<div class="wa-sent-banner">Nota terkirim ke ${c.phone}</div>` : ""}
      <div class="wa-thread">
        <div class="wa-bubble">${notaText()}
          <div class="wa-time">${state.waSent ? "09.41 ✓✓" : "draft"}</div>
        </div>
      </div>
      ${
        state.waSent
          ? `<button class="btn primary" style="margin:0 12px 16px;width:auto" data-go="orders">Selesai</button>`
          : `<div class="wa-composer">
              <p class="hint">Nota siap dikirim</p>
              <button class="wa-send" data-wa-send aria-label="Kirim">➤</button>
            </div>`
      }
    </div>
  </div>`;
}

function screenOrders() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Riwayat</p><h1>Nota</h1></div></div>
    ${state.orders.map((o) => {
      const sisa = Math.max(o.total - o.paid, 0);
      const st = payStatus(o.paid, o.total);
      return `<button class="card tap" data-open-order="${o.id}">
        <div class="row">
          <div class="grow">
            <div class="name">${o.id} · ${o.customer}</div>
            <div class="meta">${Rp(o.total)} · dibayar ${Rp(o.paid)}${sisa ? " · sisa " + Rp(sisa) : ""}</div>
          </div>
          ${chipStatus(st.id, st.label)}
          ${o.dropOut ? '<span class="chip do">DO</span>' : ""}
        </div>
      </button>`;
    }).join("")}
  </div>`;
}

function screenPelunasan() {
  const o = state.payTarget || state.orders[1];
  const sisa = o.total - o.paid;
  const extra = state.extraPay || sisa;
  const after = Math.min(o.paid + extra, o.total);
  const st = payStatus(after, o.total);
  return `<div class="screen">
    <div class="top">${backBtn("orders")}<h1>Pelunasan</h1><span></span></div>
    <div class="card">
      <div class="name">${o.id} · ${o.customer}</div>
      <div class="meta">Total ${Rp(o.total)} · sudah DP ${Rp(o.paid)}</div>
      <p class="sisa">Sisa tagihan <b>${Rp(sisa)}</b></p>
    </div>
    <label class="form"><span>Bayar tambahan</span><input value="${extra}" /></label>
    <p>${chipStatus(st.id, st.label)} setelah ini</p>
    <button class="btn wa" data-toast="Nota update dikirim ke WhatsApp pelanggan" data-go="orders">Bayar & kirim WA</button>
  </div>`;
}

function screenLayanan() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Bisa tambah / hapus</p><h1>Layanan</h1></div></div>
    ${SERVICES.map((s) => `
      <button class="card tap" data-go="layanan-form">
        <div class="name">${s.name} ${s.dropOut ? '<span class="chip do">Drop Out</span>' : ""}</div>
        <div class="meta">${s.desc}</div>
        <div class="meta">${Rp(s.price)} / ${s.unit === "kg" ? "kiloan" : "satuan"}</div>
      </button>`).join("")}
    <button class="fab" data-go="layanan-form">+ Layanan</button>
  </div>`;
}

function screenLayananForm() {
  return `<div class="screen">
    <div class="top">${backBtn("layanan")}<h1>Layanan</h1><span></span></div>
    <label class="form"><span>Nama</span><input value="Curing DO Lipat" /></label>
    <label class="form"><span>Keterangan</span><textarea rows="2">Drop Out + dilipat rapi, pelanggan tidak nunggu</textarea></label>
    <label class="form"><span>Tarif (Rp)</span><input value="12000" /></label>
    <label class="form"><span>Hitung sebagai</span>
      <select><option>Kiloan (kg)</option><option>Satuan (pcs)</option></select>
    </label>
    <label class="form"><span>Jenis</span>
      <select><option>Jasa laundry</option><option>Produk retail (potong stok)</option></select>
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
    <div class="top"><div><p class="sub">Sabun · softener · parfum</p><h1>Stok</h1></div></div>
    <div class="stats">
      <div class="stat"><div class="k">Masuk</div><div class="v">${totalIn}</div></div>
      <div class="stat"><div class="k">Keluar</div><div class="v">${totalOut}</div></div>
      <div class="stat"><div class="k">Item</div><div class="v">${state.products.length}</div></div>
    </div>
    ${state.products.map((p) => `
      <div class="card">
        <div class="name">${p.name}</div>
        <div class="meta">Sisa ${p.stock} · masuk ${p.in} · keluar ${p.out}</div>
      </div>`).join("")}
    <button class="fab" data-go="stok-masuk">+ Stok masuk</button>
  </div>`;
}

function screenStokMasuk() {
  return `<div class="screen">
    <div class="top">${backBtn("inventory")}<h1>Stok masuk</h1><span></span></div>
    <label class="form"><span>Produk</span>
      <select><option>Sabun</option><option>Softener</option><option>Parfum uk 100</option></select>
    </label>
    <label class="form"><span>Jumlah</span><input value="12" /></label>
    <label class="form"><span>Catatan</span><input placeholder="Pembelian / bonus" /></label>
    <button class="btn primary" data-toast="Stok masuk tercatat" data-go="inventory">Simpan</button>
  </div>`;
}

function screenUsers() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Akses</p><h1>User</h1></div></div>
    ${state.users.map((u) => `
      <div class="card"><div class="name">${u.name}</div><div class="meta">${u.role}</div></div>
    `).join("")}
    <button class="fab" data-toast="Form user — mockup">+ User</button>
  </div>`;
}

function screenRoles() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Bisa ditambah, modul di-custom</p><h1>Role</h1></div></div>
    ${state.roles.map((r) => `
      <div class="card">
        <div class="name">${r.name}</div>
        <div class="meta">${r.modules.map((id) => MODULES.find((m) => m.id === id)?.label).join(" · ")}</div>
      </div>`).join("")}
    <div class="card">
      <div class="name">Tambah role baru</div>
      ${MODULES.map((m) => `<div class="toggle">${m.label}<button class="switch" type="button" data-toggle-switch><i></i></button></div>`).join("")}
      <button class="btn primary" data-toast="Role tersimpan">Simpan role</button>
    </div>
  </div>`;
}

function screenProfil() {
  return `<div class="screen">
    <div class="top">${backBtn("more")}<h1>Profil usaha</h1><span></span></div>
    <label class="form"><span>Nama laundry</span><input value="Cuciin" /></label>
    <label class="form"><span>Alamat</span><textarea rows="2">Jl. Laundry Raya 1, Bandung</textarea></label>
    <p class="meta">Kepala nota WhatsApp.</p>
    <button class="btn primary" data-toast="Profil tersimpan" data-go="more">Simpan</button>
  </div>`;
}

function screenMore() {
  return `<div class="screen">
    <div class="top"><div><p class="sub">Owner</p><h1>Lainnya</h1></div></div>
    <div class="menu-list">
      <button data-go="orders">Nota & pelunasan <span>›</span></button>
      <button data-go="layanan">Layanan <span>›</span></button>
      <button data-go="users">User <span>›</span></button>
      <button data-go="roles">Role & akses <span>›</span></button>
      <button data-go="profil">Profil usaha <span>›</span></button>
      <button data-go="login">Keluar <span>›</span></button>
    </div>
  </div>`;
}

const SCREENS = {
  login: screenLogin,
  home: screenHome,
  customers: screenCustomers,
  "customer-form": screenCustomerForm,
  kasir: screenKasir,
  bayar: screenBayar,
  nota: screenNota,
  orders: screenOrders,
  pelunasan: screenPelunasan,
  layanan: screenLayanan,
  "layanan-form": screenLayananForm,
  inventory: screenInventory,
  "stok-masuk": screenStokMasuk,
  users: screenUsers,
  roles: screenRoles,
  profil: screenProfil,
  more: screenMore,
  "wa-chat": screenWaChat,
};

function qtySheet() {
  if (!state.sheet) return "";
  const s = SERVICES.find((x) => x.id === state.sheet);
  const unit = s.unit;
  return `<div class="sheet-bg" data-close-sheet>
    <div class="sheet" data-stop>
      <div class="grab"></div>
      <h2>${s.name}</h2>
      <p class="meta">${s.desc} · ${Rp(s.price)} / ${unit}</p>
      <div class="qty-row">
        <button data-qty="-1">−</button>
        <strong>${state.qtyDraft} ${unit}</strong>
        <button data-qty="1">+</button>
      </div>
      <button class="btn primary" data-add-cart="${s.id}">Tambah · ${Rp(state.qtyDraft * s.price)}</button>
    </div>
  </div>`;
}

function renderTabbar() {
  const bar = document.getElementById("tabbar");
  const hide = !state.loggedIn || ["login", "bayar", "nota", "customer-form", "layanan-form", "pelunasan", "stok-masuk", "profil", "wa-chat"].includes(state.screen);
  bar.hidden = hide;
  if (hide) {
    bar.innerHTML = "";
    return;
  }
  const tabs = TABS[state.role];
  const active = tabs.some((t) => t.id === state.screen) ? state.screen : "";
  bar.innerHTML = tabs
    .map(
      (t) => `<button class="${t.id === active ? "on" : ""}" data-go="${t.id}">${ICONS[t.icon]}${t.label}</button>`
    )
    .join("");
}

function renderJumps() {
  const nav = document.getElementById("screen-jump");
  nav.innerHTML = JUMPS.map(
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
    state.screen = id;
    state.loggedIn = id !== "login";
    if (id === "login") state.loggedIn = false;
    if (!navAllowed(id) && id !== "login") {
      state.screen = "home";
      showToast("Role ini nggak punya modul itu");
      return;
    }
    render();
    return;
  }

  const goBtn = e.target.closest("[data-go]");
  if (goBtn && !e.target.closest("[data-jump]")) {
    if (goBtn.dataset.pickCustomer) {
      state.customer = CUSTOMERS.find((c) => c.id === goBtn.dataset.pickCustomer);
    }
    const id = goBtn.dataset.go;
    if (id === "home") state.loggedIn = true;
    if (id === "login") {
      state.loggedIn = false;
      state.cart = [];
      state.paid = 0;
    }
    if ((id === "bayar" || id === "nota") && !state.cart.length) {
      state.cart = [{ ...SERVICES[2], qty: 3 }];
      state.paid = id === "nota" ? 15000 : 0;
    }
    go(id);
    if (goBtn.dataset.toast) showToast(goBtn.dataset.toast);
    return;
  }

  const pick = e.target.closest("[data-pick-customer]");
  if (pick) {
    state.customer = CUSTOMERS.find((c) => c.id === pick.dataset.pickCustomer);
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
    e.stopPropagation();
    const step = Number(q.dataset.qty);
    const s = SERVICES.find((x) => x.id === state.sheet);
    const min = s.unit === "kg" ? 0.5 : 1;
    state.qtyDraft = Math.max(min, +(state.qtyDraft + step).toFixed(1));
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
    state.extraPay = o.total - o.paid;
    go("pelunasan");
    return;
  }

  const wa = e.target.closest("[data-wa]");
  if (wa) {
    state.waSent = false;
    go("wa-chat");
    return;
  }

  const waSend = e.target.closest("[data-wa-send]");
  if (waSend) {
    state.waSent = true;
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
    const box = document.querySelector(".pay-box");
    if (box) {
      box.querySelector(".chip")?.replaceWith(
        Object.assign(document.createElement("span"), {
          className: `chip ${st.id}`,
          textContent: st.label,
        })
      );
    }
    const sisaEl = document.querySelector(".sisa");
    if (sisaEl) {
      sisaEl.innerHTML = `Sisa tagihan <b>${Rp(sisa)}</b> · ${
        st.id === "dp" ? "uang muka, pelunasan nanti" : st.id === "belum" ? "belum ada bayaran" : "sudah nutup"
      }`;
    }
  }
});

applyUrl();
render();
