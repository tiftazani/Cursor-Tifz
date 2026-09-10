import { NextResponse } from "next/server";
import {
  CUCIIN_CLOUD_KEY,
  CUCIIN_JSONBLOB_ID,
  CUCIIN_STORE_URL,
} from "@/lib/cuciin-cloud";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Store = Record<string, unknown>;

declare global {
  var __cuciinMemory: Store | undefined;
}

const empty: Store = {
  updatedAt: 0,
  branches: [],
  staff: [],
  customers: [],
  services: [],
  products: [],
  notas: [],
  stockMoves: [],
  audit: [],
  cashCloses: [],
};

function unauthorized() {
  return NextResponse.json(
    {
      ok: false,
      error: "unauthorized",
      pesan: "API Cuciin hidup. Data toko cuma dibuka dari app, bukan dari address bar. Butuh header X-Cuciin-Key.",
    },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

function wantsBrowser(req: Request) {
  const accept = req.headers.get("accept") ?? "";
  const dest = req.headers.get("sec-fetch-dest") ?? "";
  return dest === "document" || dest === "iframe" || accept.includes("text/html");
}

function countsOf(data: Store) {
  const n = (k: string) => (Array.isArray(data[k]) ? (data[k] as unknown[]).length : 0);
  return {
    branches: n("branches"),
    staff: n("staff"),
    customers: n("customers"),
    notas: n("notas"),
    products: n("products"),
  };
}

function publicStatus(data: Store) {
  return {
    ok: true,
    service: "cuciin",
    hidup: true,
    pesan: "Database server Cuciin hidup. Isi toko (nota, pelanggan) cuma dari app Android.",
    updatedAt: Number(data.updatedAt ?? 0),
    counts: countsOf(data),
  };
}

function statusHtml(data: Store) {
  const c = countsOf(data);
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cuciin — database server</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0f2744; color: #e8eef6; margin: 0; padding: 32px; }
    main { max-width: 36rem; }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    p { line-height: 1.5; color: #c5d0dc; }
    .ok { color: #7ddea0; font-weight: 700; }
    ul { padding-left: 1.2rem; color: #c5d0dc; }
    code { background: #17375e; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <p class="ok">Database hidup</p>
    <h1>Cuciin</h1>
    <p>Ini API server, bukan halaman error. Browser nggak bawa key, jadi data toko nggak ditampilkan di sini. App Android yang baca/tulis nota.</p>
    <ul>
      <li>Cabang: ${c.branches}</li>
      <li>Staff: ${c.staff}</li>
      <li>Pelanggan: ${c.customers}</li>
      <li>Nota: ${c.notas}</li>
      <li>Produk: ${c.products}</li>
    </ul>
    <p>Unduh app: <a href="/cuciin/cuciin.apk" style="color:#8ec5ff">cuciin.apk</a> · mockup <a href="/cuciin" style="color:#8ec5ff">/cuciin</a></p>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function ok(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

function keyOf(req: Request) {
  return req.headers.get("x-cuciin-key") ?? req.headers.get("authorization")?.replace(/^Bearer /i, "");
}

function isStore(v: unknown): v is Store {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function blobUrl() {
  const id = CUCIIN_JSONBLOB_ID || process.env.CUCIIN_JSONBLOB_ID || "";
  return id ? `https://jsonblob.com/api/jsonBlob/${id}` : "";
}

async function readJson(url: string): Promise<Store | null> {
  try {
    const bust = url.includes("?") ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    const r = await fetch(`${url}${bust}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!r.ok) return null;
    const data: unknown = await r.json();
    if (!isStore(data)) return null;
    if (typeof data.status === "number" && data.status !== 0 && !("updatedAt" in data)) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeJson(url: string, data: Store): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function load(): Promise<Store> {
  const fromStore = await readJson(CUCIIN_STORE_URL);
  if (fromStore && (fromStore.updatedAt !== undefined || Array.isArray(fromStore.staff))) {
    globalThis.__cuciinMemory = fromStore;
    return fromStore;
  }
  const blob = blobUrl();
  if (blob) {
    const fromBlob = await readJson(blob);
    if (fromBlob) {
      globalThis.__cuciinMemory = fromBlob;
      return fromBlob;
    }
  }
  return globalThis.__cuciinMemory ?? empty;
}

async function save(data: Store) {
  globalThis.__cuciinMemory = data;
  await writeJson(CUCIIN_STORE_URL, data);
  const blob = blobUrl();
  if (blob) await writeJson(blob, data);
}

export async function GET(req: Request) {
  if (keyOf(req) !== CUCIIN_CLOUD_KEY) {
    const data = await load();
    if (wantsBrowser(req)) return statusHtml(data);
    return ok(publicStatus(data));
  }
  const data = await load();
  return ok(data);
}

export async function PUT(req: Request) {
  if (keyOf(req) !== CUCIIN_CLOUD_KEY) return unauthorized();
  const body = (await req.json()) as Store;
  const current = await load();
  const incoming = Number(body.updatedAt ?? 0);
  const have = Number(current.updatedAt ?? 0);
  if (incoming < have) return ok(current);
  await save(body);
  return ok(body);
}

export async function POST(req: Request) {
  return PUT(req);
}
