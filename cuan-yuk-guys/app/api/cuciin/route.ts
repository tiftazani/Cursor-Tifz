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
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
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
  if (keyOf(req) !== CUCIIN_CLOUD_KEY) return unauthorized();
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
