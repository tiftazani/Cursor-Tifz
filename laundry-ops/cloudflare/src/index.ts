import { canonicalNotaPayload, pullChanges, pushCommands, syncScopeKey } from "./command-sync.ts";

interface Env {
  DB: D1Database;
  SYNC_SECRET?: string;
  /** Kunci service account Firebase (JSON atau base64-nya). Dipakai Worker untuk menghapus akun login saat user dihapus. */
  FIREBASE_SERVICE_ACCOUNT?: string;
  /** Satu project ID (format lama) atau beberapa dipisah koma. */
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_PROJECT_IDS?: string;
  ENVIRONMENT: string;
}

/**
 * Daftar project Firebase yang tokennya diterima.
 *
 * Dipisah koma supaya masa peralihan identitas aplikasi tidak memutus perangkat
 * yang masih memakai project lama. `FIREBASE_PROJECT_ID` tetap dibaca agar
 * konfigurasi lama tidak langsung mati.
 */
export function firebaseProjectIds(env: { FIREBASE_PROJECT_ID?: string; FIREBASE_PROJECT_IDS?: string }): string[] {
  const raw = env.FIREBASE_PROJECT_IDS ?? env.FIREBASE_PROJECT_ID ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

type JsonRecord = Record<string, unknown>;
const ORG_ID = "cuciin";
const MAX_BODY_BYTES = 4_000_000;
let jwksCache: { expiresAt: number; keys: JsonWebKey[] } | undefined;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function b64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function firebaseIdentity(token: string, projectId: string): Promise<{ sub: string; email: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header: JsonRecord;
  let claims: JsonRecord;
  try {
    header = JSON.parse(new TextDecoder().decode(b64url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(b64url(parts[1])));
  } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` || typeof claims.sub !== "string" || !claims.sub || Number(claims.exp) <= now || Number(claims.iat) > now + 60) return null;
  if (!jwksCache || jwksCache.expiresAt < Date.now()) {
    const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
    if (!response.ok) return null;
    const data = await response.json<{ keys: JsonWebKey[] }>();
    const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 3600);
    jwksCache = { keys: data.keys, expiresAt: Date.now() + maxAge * 1000 };
  }
  const jwk = jwksCache.keys.find((key) => (key as unknown as JsonRecord).kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]).buffer as ArrayBuffer, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) return null;
  return { sub: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
}

async function sameSecret(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(given)), crypto.subtle.digest("SHA-256", enc.encode(expected))]);
  const left = new Uint8Array(a); const right = new Uint8Array(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.min(left.length, right.length); i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

type Identity = { uid?: string; email: string; name: string; role: "Owner" | "Kasir" | "Supervisor"; branchIds: string[]; bootstrap: boolean };

async function authenticatedFirebaseUser(request: Request, env: Env): Promise<{ sub: string; email: string } | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return null;
  for (const projectId of firebaseProjectIds(env)) {
    const user = await firebaseIdentity(bearer, projectId);
    if (user?.email) return user;
  }
  return null;
}

/**
 * Menyambungkan firebase_uid ke baris staff yang cocok.
 *
 * Ini hanyalah percepatan untuk login berikutnya, bukan syarat sahnya login.
 * Kalau kuota tulis D1 sedang habis, Cloudflare menolak UPDATE ini; dulu
 * kegagalan itu menjalar ke atas dan membuat SELURUH login gagal 500 padahal
 * email dan sandinya benar. Sekarang kegagalannya diserap di sini dan
 * pencobaannya diulang pada login berikutnya.
 */
export async function linkFirebaseUid(env: Env, sub: string, email: string): Promise<boolean> {
  try {
    await env.DB.prepare("UPDATE staff SET firebase_uid=? WHERE email=? AND firebase_uid IS NULL").bind(sub, email).run();
    return true;
  } catch (error) {
    console.warn("Gagal menyambungkan firebase_uid, login tetap dilanjutkan", error);
    return false;
  }
}

/** Mencari baris staff yang sah untuk pemakai Firebase yang tokennya sudah diverifikasi. */
export async function resolveStaff(env: Env, firebaseUser: { sub: string; email: string }): Promise<{ email: string; name: string; role: string } | null> {
  let staff = await env.DB.prepare("SELECT email,name,role FROM staff WHERE firebase_uid=? AND lower(email)=lower(?) AND approved=1 AND active=1").bind(firebaseUser.sub,firebaseUser.email).first<{email:string;name:string;role:string}>();
  if (!staff) {
    staff = await env.DB.prepare("SELECT email,name,role FROM staff WHERE lower(email)=lower(?) AND approved=1 AND active=1").bind(firebaseUser.email).first<{email:string;name:string;role:string}>();
    if (staff) await linkFirebaseUid(env, firebaseUser.sub, staff.email);
  }
  return staff ?? null;
}

export async function compactAccessSnapshot(env: Env, email: string): Promise<JsonRecord> {
  const person = await env.DB.prepare("SELECT email,name,role,approved,access_role_id FROM staff WHERE organization_id=? AND lower(email)=lower(?) AND approved=1 AND active=1")
    .bind(ORG_ID,email).first<{email:string;name:string;role:string;approved:number;access_role_id:string}>();
  const branches = person ? (await env.DB.prepare("SELECT branch_id FROM staff_branches WHERE staff_email=? ORDER BY branch_id").bind(person.email).all<{branch_id:string}>()).results : [];
  const roles = (await env.DB.prepare("SELECT id,name,built_in,payload_json FROM access_roles WHERE organization_id=? ORDER BY id").bind(ORG_ID).all<{id:string;name:string;built_in:number;payload_json:string}>()).results;
  const policy = person ? await env.DB.prepare("SELECT payload_json FROM access_policies WHERE organization_id=? AND lower(email)=lower(?)").bind(ORG_ID,person.email).first<{payload_json:string}>() : null;
  return {
    staff: person ? [{name:person.name,email:person.email,role:person.role,approved:person.approved===1,branchIds:branches.map(row=>row.branch_id),accessRoleId:person.access_role_id}] : [],
    accessRoles: roles.map(row=>({...JSON.parse(row.payload_json) as JsonRecord,id:row.id,name:row.name,builtIn:row.built_in===1})),
    accessPolicies: policy && person ? [{...JSON.parse(policy.payload_json) as JsonRecord,email:person.email}] : [],
    updatedAt: Date.now(),
  };
}

async function authorize(request: Request, env: Env): Promise<Identity | null> {
  const firebaseUser = await authenticatedFirebaseUser(request, env);
  if (firebaseUser) {
    const staff = await resolveStaff(env, firebaseUser);
    if (staff && ["Owner","Kasir","Supervisor"].includes(staff.role)) {
      const branches = await env.DB.prepare("SELECT branch_id FROM staff_branches WHERE staff_email=? ORDER BY branch_id").bind(staff.email).all<{branch_id:string}>();
      return { uid: firebaseUser.sub, email: firebaseUser.email, name: staff.name, role: staff.role as Identity["role"], branchIds: branches.results.map((row) => row.branch_id), bootstrap: false };
    }
  }
  const key = request.headers.get("x-cuciin-key") ?? "";
  if (env.SYNC_SECRET && key && await sameSecret(key, env.SYNC_SECRET)) return { email: "bootstrap", name: "Bootstrap", role: "Owner", branchIds: [], bootstrap: true };
  return null;
}

async function registerAccount(request: Request, env: Env): Promise<Response> {
  const firebaseUser = await authenticatedFirebaseUser(request, env);
  if (!firebaseUser?.email) return json({ error: "Identitas Firebase tidak valid" }, 401);
  const text = await request.text();
  let body: JsonRecord;
  try { body = JSON.parse(text) as JsonRecord; } catch { return json({ error: "Data pendaftaran tidak valid" }, 422); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const branchId = typeof body.branchId === "string" ? body.branchId.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  if (!name || name.length > 160 || !email || email !== firebaseUser.email.toLowerCase() || !branchId || !["Owner", "Kasir", "Supervisor"].includes(role)) {
    return json({ error: "Data pendaftaran tidak valid" }, 422);
  }
  const [existing, branch] = await Promise.all([
    env.DB.prepare("SELECT email FROM staff WHERE lower(email)=lower(?)").bind(email).first<{email:string}>(),
    env.DB.prepare("SELECT id FROM branches WHERE id=? AND organization_id=?").bind(branchId, ORG_ID).first<{id:string}>(),
  ]);
  if (existing) return json({ error: "Email sudah terdaftar atau masih menunggu persetujuan" }, 409);
  if (!branch) return json({ error: "Cabang tidak ditemukan" }, 422);
  const now = Date.now();
  const payload = { name, email, role, branchIds: [branchId], approved: false };
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO organizations(id,name,owner_email,created_at,updated_at) VALUES(?,?,?,?,?)").bind(ORG_ID, "Cuciin", "tiftazani.khara@gmail.com", now, now),
    env.DB.prepare("INSERT INTO staff(email,organization_id,name,role,approved,active,firebase_uid,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(email, ORG_ID, name, role, 0, 1, firebaseUser.sub, now),
    env.DB.prepare("INSERT INTO staff_branches(staff_email,branch_id) VALUES(?,?)").bind(email, branchId),
    env.DB.prepare("INSERT INTO sync_changes(organization_id,entity_type,entity_id,operation,payload_json,updated_at,branch_id,actor_email,command_id) VALUES(?,?,?,?,?,?,?,?,?)").bind(ORG_ID, "staff", email, "upsert", JSON.stringify(payload), now, branchId, email, `registration:${firebaseUser.sub}`),
  ]);
  return json({ status: "pending" }, 201);
}

function list(snapshot: JsonRecord, key: string): JsonRecord[] {
  const value = snapshot[key];
  return Array.isArray(value) ? value.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object") : [];
}
function str(row: JsonRecord, key: string, fallback = ""): string { return typeof row[key] === "string" ? row[key] as string : fallback; }
function num(row: JsonRecord, key: string, fallback = 0): number { return typeof row[key] === "number" && Number.isFinite(row[key]) ? row[key] as number : fallback; }
function bool(row: JsonRecord, key: string): number { return row[key] === true ? 1 : 0; }

const BRANCH_DATASETS = ["branchStocks", "inventory", "expenses", "notas", "stockMoves", "audit", "cashCloses", "payments", "attendance"] as const;

function rowKey(dataset: string, row: JsonRecord): string {
  if (dataset === "branchStocks") return `${str(row,"branchId")}|${str(row,"productKey")}`;
  if (dataset === "stockMoves") return str(row,"syncId") || `${str(row,"branchId")}|${num(row,"atMs")}|${str(row,"product")}|${str(row,"kind")}|${str(row,"notaId")}`;
  if (dataset === "audit") return str(row,"syncId") || `${str(row,"branchId")}|${num(row,"atMs")}|${str(row,"user")}|${str(row,"action")}|${str(row,"notaId")}`;
  return str(row, "id") || `${str(row,"branchId")}|${num(row,"atMs")}|${str(row,"staffEmail")}`;
}

function mergeRows(dataset: string, current: JsonRecord[], incoming: JsonRecord[]): JsonRecord[] {
  const rows = new Map(current.map((row) => [rowKey(dataset, row), row]));
  for (const row of incoming) rows.set(rowKey(dataset, row), row);
  return [...rows.values()];
}

export function visibleSnapshot(snapshot: JsonRecord, identity: Identity): JsonRecord {
  if (identity.role === "Owner" || identity.bootstrap) return snapshot;
  const allowed = new Set(identity.branchIds);
  const result: JsonRecord = { ...snapshot, sessionEmail: null, viewBranch: identity.branchIds[0] ?? "", viewKasir: "all" };
  result.branches = list(snapshot, "branches").filter((row) => allowed.has(str(row,"id")));
  result.staff = list(snapshot, "staff").filter((row) => {
    const ids = Array.isArray(row.branchIds) ? row.branchIds : [];
    return ids.some((id) => typeof id === "string" && allowed.has(id));
  });
  for (const dataset of BRANCH_DATASETS) result[dataset] = list(snapshot, dataset).filter((row) =>
    allowed.has(str(row,"branchId")) && (dataset !== "attendance" || str(row,"staffEmail").toLowerCase() === identity.email.toLowerCase())
  );
  return result;
}

function mergeRestrictedSnapshot(current: JsonRecord, incoming: JsonRecord, identity: Identity): JsonRecord {
  if (identity.role === "Owner" || identity.bootstrap) return incoming;
  const allowed = new Set(identity.branchIds);
  const merged: JsonRecord = { ...current, updatedAt: num(incoming,"updatedAt"), sessionEmail: null };
  merged.customers = mergeRows("customers", list(current,"customers"), list(incoming,"customers"));
  for (const dataset of BRANCH_DATASETS) {
    const accepted = list(incoming, dataset).filter((row) =>
      allowed.has(str(row,"branchId")) && (dataset !== "attendance" || str(row,"staffEmail").toLowerCase() === identity.email.toLowerCase())
    );
    merged[dataset] = mergeRows(dataset, list(current,dataset), accepted);
  }
  const tombstones = new Set([...listOfStrings(current.deletedNotaIds), ...listOfStrings(incoming.deletedNotaIds)]);
  merged.deletedNotaIds = [...tombstones];
  merged.notas = list(merged,"notas").filter((row) => !tombstones.has(str(row,"id")));
  return merged;
}

function listOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export type SnapshotJournalChange = {
  sequence: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload_json: string | null;
  updated_at: number;
};

const CHANGE_DATASETS:Record<string,string>={
  branch:"branches",staff:"staff",customer:"customers",service:"services",product:"products",branchStock:"branchStocks",
  inventory:"inventory",assetType:"assetTypes",expense:"expenses",nota:"notas",order:"notas",stockMove:"stockMoves",audit:"audit",cashClose:"cashCloses",payment:"payments",attendance:"attendance",accessRole:"accessRoles",accessPolicy:"accessPolicies",whatsappTemplate:"whatsappTemplates",
};

function journalEntityId(dataset:string,row:JsonRecord):string {
  if(dataset==="branchStocks") return `${str(row,"branchId")}:${str(row,"productKey")}`;
  if(dataset==="stockMoves" || dataset==="audit") return str(row,"syncId") || rowKey(dataset,row);
  if(dataset==="staff") return str(row,"email").toLowerCase();
  if(dataset==="products") return str(row,"id") || str(row,"name");
  return str(row,"id");
}

/**
 * Identitas absensi: (karyawan, tanggal, cabang). `null` bila salah satunya kosong.
 *
 * Absensi sengaja tidak dikenali dari `id`. Dua perangkat bisa memakai skema id berbeda untuk
 * catatan yang sama: perangkat 1.10.37 ke bawah memakai id acak, perangkat 1.10.38 memakai id
 * deterministik per (cabang, tanggal, karyawan). Di tabel keduanya menjadi satu baris karena
 * `UNIQUE(staff_email, work_date, branch_id)` menangkap yang kedua, tetapi di jurnal tercatat
 * sebagai dua `entity_id` berbeda.
 */
function attendanceIdentity(row:JsonRecord):string|null {
  const email=str(row,"staffEmail").toLowerCase();
  const workDate=str(row,"workDate");
  const branchId=str(row,"branchId");
  if(!email || !workDate || !branchId) return null;
  return `${email}|${workDate}|${branchId}`;
}

/**
 * Menyisakan satu baris per (karyawan, tanggal, cabang).
 *
 * Dipakai sebagai jaring pengaman: snapshot lama yang sudah telanjur memuat baris kembar dari
 * jurnal dengan dua skema id dibersihkan saat dibaca. Yang dipertahankan adalah catatan paling
 * lengkap: baris yang sudah punya jam pulang menang atas yang belum, dan bila keduanya sama
 * lengkap, yang jam masuknya paling akhir.
 */
/** Baris absensi yang sudah punya jam pulang (atau jam masuk lebih baru) dianggap lebih lengkap. */
function absensiLebihLengkap(baru:JsonRecord,lama:JsonRecord):boolean {
  const pulangBaru=num(baru,"checkOutAtMs") > 0;
  const pulangLama=num(lama,"checkOutAtMs") > 0;
  if(pulangBaru!==pulangLama) return pulangBaru;
  return num(baru,"checkInAtMs") >= num(lama,"checkInAtMs");
}

function dedupeAttendance(rows:JsonRecord[]):JsonRecord[] {
  const best=new Map<string,JsonRecord>();
  const passthrough:JsonRecord[]=[];
  for(const row of rows) {
    const key=attendanceIdentity(row);
    if(!key) { passthrough.push(row); continue; }
    const previous=best.get(key);
    if(!previous || absensiLebihLengkap(row,previous)) best.set(key,row);
  }
  return [...passthrough,...best.values()];
}

/**
 * Menggabungkan kiriman absensi dengan baris yang sudah ada tanpa mengosongkan isinya.
 *
 * Aturan pemilik: absen pagi dan sore adalah SATU catatan harian, dan "tidak boleh ada yang
 * menimpa". Kiriman berikutnya untuk catatan yang sama boleh mengisi jam pulang, tetapi tidak
 * boleh mengosongkan jam masuk, jam pulang, atau catatan yang sudah tercatat. Tanpa aturan ini,
 * perangkat yang belum menarik perubahan (atau perangkat lama yang mengirim ulang barisnya)
 * menghapus jam pulang yang sudah dicatat perangkat lain.
 */
function gabungAbsensi(lama:JsonRecord|null,baru:JsonRecord):JsonRecord {
  if(!lama) return baru;
  const hasil={...baru};
  // Jam masuk dan jam pulang yang SUDAH tercatat tidak pernah ditimpa. Ini sejalan dengan SQL
  // `ON CONFLICT ... check_in_at=attendance.check_in_at, check_out_at=COALESCE(...)`, supaya isi
  // tabel dan isi snapshot tidak pernah berbeda cerita.
  if(num(lama,"checkInAtMs")>0) {
    hasil.checkInAtMs=num(lama,"checkInAtMs");
    if(str(lama,"checkInAt")) hasil.checkInAt=str(lama,"checkInAt");
  }
  if(num(lama,"checkOutAtMs")>0) {
    hasil.checkOutAtMs=num(lama,"checkOutAtMs");
    if(str(lama,"checkOutAt")) hasil.checkOutAt=str(lama,"checkOutAt");
  }
  if(!str(baru,"note") && str(lama,"note")) hasil.note=str(lama,"note");
  return hasil;
}

export function applyJournalToSnapshot(base:JsonRecord,changes:SnapshotJournalChange[],revision:number):JsonRecord {
  const snapshot:JsonRecord={...base};
  const datasets=new Map<string,Map<string,JsonRecord>>();
  const attendanceKeys=new Map<string,string>();
  const deleted=new Set(listOfStrings(base.deletedNotaIds));
  let notasChanged=false;
  for(const change of changes) {
    const dataset=CHANGE_DATASETS[change.entity_type];
    if(!dataset) continue;
    let rows=datasets.get(dataset);
    if(!rows) {
      const initial=dataset==="attendance" ? dedupeAttendance(list(base,dataset)) : list(base,dataset);
      rows=new Map(initial.map(row=>[journalEntityId(dataset,row),row]));
      datasets.set(dataset,rows);
      if(dataset==="attendance") for(const [id,row] of rows) {
        const key=attendanceIdentity(row); if(key) attendanceKeys.set(key,id);
      }
    }
    const parsed=change.payload_json ? JSON.parse(change.payload_json) as unknown : null;
    const incoming=parsed && typeof parsed==="object" && !Array.isArray(parsed) ? parsed as JsonRecord : null;
    let previous=rows.get(change.entity_id) ?? null;
    const key=dataset==="attendance" && incoming ? attendanceIdentity(incoming) : null;
    if(key) {
      const otherId=attendanceKeys.get(key);
      const other=otherId === undefined ? null : rows.get(otherId) ?? null;
      if(other && (!previous || absensiLebihLengkap(other,previous))) previous=other;
      if(otherId!==undefined) rows.delete(otherId);
    }
    if(dataset==="attendance") {
      const old=rows.get(change.entity_id);
      const oldKey=old ? attendanceIdentity(old) : null;
      if(oldKey) attendanceKeys.delete(oldKey);
      if(key) attendanceKeys.delete(key);
    }
    rows.delete(change.entity_id);
    if(change.operation!=="delete" && incoming) {
      const row=dataset==="attendance" ? gabungAbsensi(previous,incoming) : dataset==="notas" && typeof incoming.cashierName==="string" ? canonicalNotaPayload(incoming) : incoming;
      const id=journalEntityId(dataset,row);
      rows.delete(id);
      rows.set(id,row);
      if(key) attendanceKeys.set(key,id);
    }
    if(dataset==="notas") {
      if(change.operation==="delete") deleted.add(change.entity_id); else deleted.delete(change.entity_id);
      notasChanged=true;
    }
    snapshot.updatedAt=Math.max(num(snapshot,"updatedAt"),change.updated_at);
  }
  for(const [dataset,rows] of datasets) snapshot[dataset]=[...rows.values()];
  if(notasChanged) snapshot.deletedNotaIds=[...deleted];
  snapshot.syncRevision=revision;
  return snapshot;
}

export async function materializedSnapshot(env:Env,row?:{payload_json:string}|null):Promise<{snapshot:JsonRecord;revision:number}> {
  const stored=row === undefined ? await env.DB.prepare("SELECT payload_json FROM sync_snapshots WHERE organization_id=?").bind(ORG_ID).first<{payload_json:string}>() : row;
  let snapshot=stored ? withoutLocalCredentials(JSON.parse(stored.payload_json) as JsonRecord) : {};
  const storedRevision=num(snapshot,"syncRevision");
  // Freeze the read boundary: concurrent commands belong to the next pull, not this cached base.
  const head=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
  const target=head?.revision ?? 0;
  if(storedRevision>target) throw new Error("snapshot_recovery_required: revisi cache melampaui jurnal; restore sumber durable harus diverifikasi");
  let revision=storedRevision;
  const changes:SnapshotJournalChange[]=[];
  while(revision<target) {
    const page=(await env.DB.prepare("SELECT sequence,entity_type,entity_id,operation,payload_json,updated_at FROM sync_changes WHERE organization_id=? AND sequence>? AND sequence<=? ORDER BY sequence ASC LIMIT 4000").bind(ORG_ID,revision,target).all<SnapshotJournalChange>()).results;
    if(!page.length) break;
    changes.push(...page);
    revision=page.at(-1)?.sequence ?? revision;
  }
  const missing=(await env.DB.prepare(`SELECT c.sequence,c.entity_type,c.entity_id,c.operation,c.payload_json,c.updated_at,
      o.payload_json AS order_payload,o.branch_id AS order_branch,o.updated_at AS order_updated_at,
      EXISTS(SELECT 1 FROM sync_changes future WHERE future.organization_id=c.organization_id
        AND future.entity_type IN ('nota','order') AND future.entity_id=c.entity_id AND future.sequence>?) AS advanced
    FROM sync_changes c LEFT JOIN orders o ON o.organization_id=c.organization_id AND o.id=c.entity_id
    WHERE c.organization_id=? AND c.sequence<=? AND c.entity_type IN ('nota','order')
      AND c.operation='upsert' AND (c.payload_json IS NULL OR trim(c.payload_json)='null')
      AND NOT EXISTS(SELECT 1 FROM sync_changes later WHERE later.organization_id=c.organization_id
        AND later.entity_type IN ('nota','order') AND later.entity_id=c.entity_id AND later.sequence>c.sequence AND later.sequence<=?)`)
    .bind(target,ORG_ID,target,target).all<SnapshotJournalChange & {order_payload:string|null;order_branch:string|null;order_updated_at:number|null;advanced:number}>()).results;
  for(const change of missing) {
    let payload:unknown;
    try { payload=change.order_payload ? JSON.parse(change.order_payload) : null; } catch { payload=null; }
    if(change.advanced || change.order_updated_at==null || change.order_updated_at>change.updated_at || !payload || typeof payload!=="object" || Array.isArray(payload))
      throw new Error(`snapshot_recovery_required: payload nota ${change.entity_id} tidak tersedia pada revisi ${target}`);
    const source=payload as JsonRecord;
    const nota=canonicalNotaPayload(source);
    if(typeof (source.kasir ?? source.cashierName)!=="string" || typeof (source.customer ?? source.customerName)!=="string"
      || (typeof source.createdAt!=="string" && typeof source.createdAt!=="number") || !Array.isArray(source.lines)
      || ![nota.total,nota.paid,nota.updatedAtMs].every(value=>typeof value==="number" && Number.isSafeInteger(value) && value>=0)
      || Number(nota.paid)>Number(nota.total) || nota.updatedAtMs!==change.order_updated_at
      || ![nota.pay,nota.payMethod,nota.laundry].every(value=>typeof value==="string" && value.length>0))
      throw new Error(`snapshot_recovery_required: payload nota ${change.entity_id} tidak lengkap`);
    if(str(nota,"id")!==change.entity_id || !change.order_branch || str(nota,"branchId")!==change.order_branch)
      throw new Error(`snapshot_recovery_required: identitas payload nota ${change.entity_id} tidak cocok`);
    change.payload_json=JSON.stringify(nota);
  }
  snapshot=withoutLocalCredentials(applyJournalToSnapshot(snapshot,[...changes,...missing],revision));
  snapshot.attendance=dedupeAttendance(list(snapshot,"attendance"));
  if(!num(snapshot,"updatedAt")) snapshot.updatedAt=Date.now();
  if(!stored || revision>storedRevision || (missing.length && JSON.stringify(snapshot)!==stored.payload_json)) {
    try {
      await env.DB.prepare(`INSERT INTO sync_snapshots(organization_id,revision,payload_json,updated_at) VALUES(?,?,?,?)
        ON CONFLICT(organization_id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json,updated_at=excluded.updated_at
        WHERE COALESCE(CAST(json_extract(sync_snapshots.payload_json,'$.syncRevision') AS INTEGER),0)<?
          OR (COALESCE(CAST(json_extract(sync_snapshots.payload_json,'$.syncRevision') AS INTEGER),0)=? AND sync_snapshots.payload_json=?)`)
        .bind(ORG_ID,num(snapshot,"updatedAt"),JSON.stringify(snapshot),Date.now(),revision,revision,stored?.payload_json ?? "").run();
    } catch {
      console.warn("Snapshot cache tidak dapat ditulis; hasil baca tetap tersedia");
    }
  }
  return {snapshot,revision};
}

export function legacySnapshotWriteAllowed(identity:{bootstrap:boolean}, journalRevision = 0):boolean {
  return identity.bootstrap && journalRevision === 0;
}

function withoutLocalCredentials(snapshot:JsonRecord):JsonRecord {
  const safe={...snapshot};
  safe.staff=list(snapshot,"staff").map(({passwordHash: _passwordHash,...person})=>person);
  if(Array.isArray(snapshot.notas)) safe.notas=list(snapshot,"notas").map(row=>typeof row.cashierName==="string" ? canonicalNotaPayload(row) : row);
  return safe;
}

async function projectSnapshot(env: Env, snapshot: JsonRecord, updatedAt: number): Promise<void> {
  // Satu nilai updated_at dipakai untuk semua tabel. Bila nilai itu lebih kecil
  // dari updated_at baris yang sudah ada, versi entity mundur dan perangkat
  // menolak sinkronisasi karena OCC. Naikkan ke nilai tertinggi yang ada.
  // D1 membatasi jumlah term compound SELECT, jadi tiap tabel dihitung terpisah.
  const ceilingSources: Array<[string, boolean]> = [
    ["orders", true], ["branches", true], ["staff", true], ["services", true], ["products", true],
    ["customers", true], ["branch_stocks", false], ["expenses", true], ["attendance", true],
    ["inventory_items", true], ["stock_moves", true], ["cash_closes", true], ["payments", true],
    ["access_policies", true], ["whatsapp_templates", true], ["asset_types", true], ["access_roles", true],
  ];
  const ceilings = await env.DB.batch<{highest: number | null}>(
    ceilingSources.map(([table, scoped]) =>
      scoped
        ? env.DB.prepare(`SELECT MAX(updated_at) AS highest FROM ${table} WHERE organization_id=?`).bind(ORG_ID)
        : env.DB.prepare(`SELECT MAX(updated_at) AS highest FROM ${table}`),
    ),
  );
  const highest = ceilings.reduce((max, row) => Math.max(max, row.results?.[0]?.highest ?? 0), 0);
  const version = Math.max(updatedAt, highest);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("INSERT INTO organizations(id,name,owner_email,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at").bind(ORG_ID, "Cuciin", "tiftazani.khara@gmail.com", version, version),
  ];
  for (const deletedId of listOfStrings(snapshot.deletedNotaIds)) statements.push(env.DB.prepare("DELETE FROM orders WHERE id=? AND organization_id=?").bind(deletedId,ORG_ID));
  for (const branch of list(snapshot, "branches")) statements.push(env.DB.prepare("INSERT INTO branches(id,organization_id,code,name,address,maps_query,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,address=excluded.address,maps_query=excluded.maps_query,updated_at=excluded.updated_at").bind(str(branch,"id"),ORG_ID,str(branch,"code"),str(branch,"name"),str(branch,"location"),str(branch,"mapsQuery"),version));
  for (const person of list(snapshot, "staff")) {
    const email = str(person,"email").toLowerCase();
    statements.push(env.DB.prepare("INSERT INTO staff(email,organization_id,name,role,approved,access_role_id,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,approved=excluded.approved,access_role_id=excluded.access_role_id,updated_at=excluded.updated_at").bind(email,ORG_ID,str(person,"name"),str(person,"role","Kasir"),bool(person,"approved"),str(person,"accessRoleId"),version));
    const branchIds = Array.isArray(person.branchIds) ? person.branchIds : [];
    for (const branchId of branchIds) if (typeof branchId === "string") statements.push(env.DB.prepare("INSERT OR IGNORE INTO staff_branches(staff_email,branch_id) VALUES(?,?)").bind(email,branchId));
  }
  for (const service of list(snapshot, "services")) statements.push(env.DB.prepare("INSERT INTO services(id,organization_id,name,unit,default_price,commission_per_unit,retail,drop_out,self_service,product_id,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,default_price=excluded.default_price,commission_per_unit=excluded.commission_per_unit,retail=excluded.retail,drop_out=excluded.drop_out,self_service=excluded.self_service,product_id=excluded.product_id,updated_at=excluded.updated_at").bind(str(service,"id"),ORG_ID,str(service,"name"),str(service,"unit"),num(service,"price"),num(service,"commissionPerUnit"),bool(service,"retail"),bool(service,"dropOut"),bool(service,"selfService"),str(service,"productKey") || null,version));
  for (const customer of list(snapshot, "customers")) statements.push(env.DB.prepare("INSERT INTO customers(id,organization_id,name,phone,address,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,address=excluded.address,updated_at=excluded.updated_at").bind(str(customer,"id"),ORG_ID,str(customer,"name"),str(customer,"phone"),str(customer,"address"),version));
  for (const product of list(snapshot, "products")) {
    const productId = str(product,"id").trim() || str(product,"name");
    statements.push(env.DB.prepare("INSERT INTO products(id,organization_id,name,minimum_stock,kind,unit,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,minimum_stock=excluded.minimum_stock,kind=excluded.kind,unit=excluded.unit,updated_at=excluded.updated_at").bind(productId,ORG_ID,str(product,"name"),num(product,"min"),str(product,"kind","BahanHabisPakai"),str(product,"unit","pcs"),version));
  }
  for (const stock of list(snapshot, "branchStocks")) statements.push(env.DB.prepare("INSERT INTO branch_stocks(branch_id,product_id,quantity,updated_at) VALUES(?,?,?,?) ON CONFLICT(branch_id,product_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at").bind(str(stock,"branchId"),str(stock,"productKey"),num(stock,"stock"),version));
  for (const item of list(snapshot, "inventory")) statements.push(env.DB.prepare("INSERT INTO inventory_items(id,organization_id,branch_id,payload_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(str(item,"id"),ORG_ID,str(item,"branchId"),JSON.stringify(item),version));
  for (const expense of list(snapshot, "expenses")) statements.push(env.DB.prepare("INSERT INTO expenses(id,organization_id,branch_id,category,amount,occurred_at,officer,note,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,category=excluded.category,amount=excluded.amount,occurred_at=excluded.occurred_at,officer=excluded.officer,note=excluded.note,updated_at=excluded.updated_at").bind(str(expense,"id"),ORG_ID,str(expense,"branchId"),str(expense,"category"),num(expense,"amount"),num(expense,"occurredAtMs"),str(expense,"by"),str(expense,"note"),version));
  for (const nota of list(snapshot, "notas")) {
    const orderId = str(nota,"id");
    statements.push(env.DB.prepare("INSERT INTO orders(id,organization_id,branch_id,cashier_email,cashier_name,customer_name,phone,total,paid,payment_status,payment_method,work_status,created_at,estimated_finish,completed_at,picked_up_at,wa_sent,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,cashier_email=excluded.cashier_email,cashier_name=excluded.cashier_name,customer_name=excluded.customer_name,phone=excluded.phone,total=excluded.total,paid=excluded.paid,payment_status=excluded.payment_status,payment_method=excluded.payment_method,work_status=excluded.work_status,created_at=excluded.created_at,estimated_finish=excluded.estimated_finish,completed_at=excluded.completed_at,picked_up_at=excluded.picked_up_at,wa_sent=excluded.wa_sent,updated_at=excluded.updated_at").bind(orderId,ORG_ID,str(nota,"branchId"),str(nota,"kasirEmail"),str(nota,"kasir"),str(nota,"customer"),str(nota,"phone"),num(nota,"total"),num(nota,"paid"),str(nota,"pay"),str(nota,"payMethod"),str(nota,"laundry"),num(nota,"createdAtMs"),str(nota,"pickupAt"),nota.completedAt ?? null,nota.pickedUpAt ?? null,bool(nota,"waSent"),version));
    statements.push(env.DB.prepare("DELETE FROM order_lines WHERE order_id=?").bind(orderId));
    const lines = Array.isArray(nota.lines) ? nota.lines.filter((x): x is JsonRecord => Boolean(x) && typeof x === "object") : [];
    lines.forEach((line, index) => statements.push(env.DB.prepare("INSERT INTO order_lines(order_id,service_id,line_no,service_name,quantity,unit,unit_price,handler_email,handler_name,commission_per_unit) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(orderId,str(line,"serviceId"),index,str(line,"name"),num(line,"qty"),str(line,"unit"),num(line,"unitPrice"),str(line,"handledByEmail"),str(line,"handledByName"),num(line,"commissionPerUnit"))));
  }
  // Dua kunci unik dijaga sekaligus: `id` (dipakai perangkat versi baru, deterministik per
  // cabang+tanggal) dan (staff_email, work_date, branch_id) (dipakai perangkat versi lama yang
  // masih mengirim id acak). Tanpa klausa kedua, absen dari aplikasi lama akan menabrak batas
  // unik dan ditolak 409, lalu antreannya macet.
  // Aturan pemilik: absensi tidak boleh saling menimpa. Jalur snapshot pun menahan jam masuk
  // yang sudah tercatat, mengisi jam pulang yang masih kosong, dan tidak menghapus catatan.
  for (const row of list(snapshot, "attendance")) statements.push(env.DB.prepare("INSERT INTO attendance(id,organization_id,branch_id,staff_email,staff_name,work_date,check_in_at,check_out_at,note,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET branch_id=excluded.branch_id,staff_name=excluded.staff_name,work_date=excluded.work_date,check_in_at=attendance.check_in_at,check_out_at=COALESCE(attendance.check_out_at,excluded.check_out_at),note=CASE WHEN excluded.note='' THEN attendance.note ELSE excluded.note END,updated_at=excluded.updated_at ON CONFLICT(staff_email,work_date,branch_id) DO UPDATE SET staff_name=excluded.staff_name,check_in_at=attendance.check_in_at,check_out_at=COALESCE(attendance.check_out_at,excluded.check_out_at),note=CASE WHEN excluded.note='' THEN attendance.note ELSE excluded.note END,updated_at=excluded.updated_at").bind(str(row,"id"),ORG_ID,str(row,"branchId"),str(row,"staffEmail").toLowerCase(),str(row,"staffName"),str(row,"workDate"),num(row,"checkInAtMs"),typeof row.checkOutAtMs === "number" ? row.checkOutAtMs : null,str(row,"note"),version));
  for (const policy of list(snapshot, "accessPolicies")) statements.push(env.DB.prepare("INSERT INTO access_policies(email,organization_id,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(email,organization_id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(str(policy,"email").toLowerCase(),ORG_ID,JSON.stringify(policy),version));
  for (const template of list(snapshot, "whatsappTemplates")) statements.push(env.DB.prepare("INSERT INTO whatsapp_templates(id,organization_id,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(id,organization_id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(str(template,"id","business"),ORG_ID,JSON.stringify(template),version));
  for (const assetType of list(snapshot, "assetTypes")) statements.push(env.DB.prepare("INSERT INTO asset_types(id,organization_id,code,name,active,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active,updated_at=excluded.updated_at").bind(str(assetType,"id"),ORG_ID,str(assetType,"code").toUpperCase(),str(assetType,"name"),assetType.active===false?0:1,version));
  for (const accessRole of list(snapshot, "accessRoles")) statements.push(env.DB.prepare("INSERT INTO access_roles(id,organization_id,name,built_in,payload_json,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(str(accessRole,"id"),ORG_ID,str(accessRole,"name"),accessRole.builtIn===true?1:0,JSON.stringify(accessRole),version));
  list(snapshot, "stockMoves").forEach((row, index) => statements.push(env.DB.prepare("INSERT INTO stock_moves(id,organization_id,branch_id,payload_json,occurred_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(str(row,"syncId") || `${str(row,"branchId")}:${num(row,"atMs")}:${str(row,"product")}:${index}`,ORG_ID,str(row,"branchId"),JSON.stringify(row),num(row,"atMs"),version)));
  list(snapshot, "audit").forEach((row, index) => statements.push(env.DB.prepare("INSERT INTO audit_logs(id,organization_id,branch_id,actor,action,order_id,occurred_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(str(row,"syncId") || `${str(row,"branchId")}:${num(row,"atMs")}:${index}`,ORG_ID,str(row,"branchId"),str(row,"user"),str(row,"action"),row.notaId ?? null,num(row,"atMs"))));
  for (const row of list(snapshot, "cashCloses")) statements.push(env.DB.prepare("INSERT INTO cash_closes(id,organization_id,branch_id,payload_json,occurred_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(str(row,"id"),ORG_ID,str(row,"branchId"),JSON.stringify(row),num(row,"atMs"),version));
  for (const payment of list(snapshot, "payments")) statements.push(env.DB.prepare("INSERT OR IGNORE INTO payments(id,organization_id,order_id,branch_id,amount,method,received_at,received_by,payload_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(str(payment,"id"),ORG_ID,str(payment,"notaId"),str(payment,"branchId"),num(payment,"amount"),str(payment,"method"),num(payment,"atMs"),str(payment,"by"),JSON.stringify(payment),version));
  for (let i = 0; i < statements.length; i += 80) await env.DB.batch(statements.slice(i, i + 80));
}

async function putSnapshot(request: Request, env: Env, identity: Identity): Promise<Response> {
  const journal=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
  if(!legacySnapshotWriteAllowed(identity,journal?.revision ?? 0)) return json({error:identity.bootstrap ? "Bootstrap snapshot ditutup setelah command sync aktif" : "Versi aplikasi wajib diperbarui sebelum sinkronisasi"},identity.bootstrap ? 409 : 426);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return json({ error: "Payload terlalu besar" }, 413);
  const requestText = await request.text();
  if (new TextEncoder().encode(requestText).byteLength > MAX_BODY_BYTES) return json({ error: "Payload terlalu besar" }, 413);
  let incoming: JsonRecord;
  try { incoming = JSON.parse(requestText); } catch { return json({ error: "JSON tidak valid" }, 400); }
  const updatedAt = num(incoming, "updatedAt");
  if (!updatedAt || !Array.isArray(incoming.branches) || !Array.isArray(incoming.staff)) return json({ error: "Snapshot tidak lengkap" }, 422);
  const current = await env.DB.prepare("SELECT revision,payload_json FROM sync_snapshots WHERE organization_id=?").bind(ORG_ID).first<{revision:number;payload_json:string}>();
  if (current && current.revision > updatedAt && (identity.role === "Owner" || identity.bootstrap)) return json({ error: "Versi server lebih baru", revision: current.revision }, 409);
  const materialized=await materializedSnapshot(env,current);
  const currentSnapshot=materialized.snapshot;
  const snapshot = withoutLocalCredentials(mergeRestrictedSnapshot(currentSnapshot, withoutLocalCredentials(incoming), identity));
  const revision = Math.max(Date.now(), updatedAt, (current?.revision ?? 0) + 1);
  snapshot.updatedAt = revision;
  snapshot.syncRevision=materialized.revision;
  const text = JSON.stringify(snapshot);
  await projectSnapshot(env, snapshot, revision);
  await env.DB.prepare("INSERT INTO sync_snapshots(organization_id,revision,payload_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json,updated_at=excluded.updated_at WHERE excluded.revision>=sync_snapshots.revision").bind(ORG_ID,revision,text,Date.now()).run();
  return json({ ok: true, revision });
}

async function report(request: Request, env: Env, identity: Identity): Promise<Response> {
  const url = new URL(request.url);
  const from = Number(url.searchParams.get("from") ?? 0);
  const until = Number(url.searchParams.get("until") ?? Date.now());
  const branch = url.searchParams.get("branch");
  if (identity.role !== "Owner" && (!branch || !identity.branchIds.includes(branch))) return json({ error: "Cabang tidak diizinkan" }, 403);
  const query = `SELECT o.branch_id,o.id AS order_id,o.created_at,o.cashier_name,l.handler_name,l.handler_email,l.service_name,l.quantity,l.unit,l.unit_price,(l.quantity*l.unit_price) AS revenue,(l.quantity*l.commission_per_unit) AS commission FROM orders o JOIN order_lines l ON l.order_id=o.id WHERE o.organization_id=? AND o.created_at BETWEEN ? AND ? ${branch ? "AND o.branch_id=?" : ""} ORDER BY o.created_at DESC`;
  const stmt = env.DB.prepare(query).bind(ORG_ID,from,until,...(branch ? [branch] : []));
  return json({ rows: (await stmt.all()).results });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      try {
        const db=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
        return json({ ok:true,service:"cuciin-api",environment:env.ENVIRONMENT,database:"ready",revision:db?.revision ?? 0 });
      } catch(error) {
        console.error("health_database_failed",error);
        return json({ok:false,service:"cuciin-api",environment:env.ENVIRONMENT,database:"unavailable"},503);
      }
    }
    if (url.pathname === "/v1/registration" && request.method === "POST") return registerAccount(request, env);
    const identity = await authorize(request, env);
    if (!identity) return json({ error: "Tidak terautentikasi" }, 401);
    try {
    if (url.pathname === "/v1/me" && request.method === "GET") {
      return json({ email: identity.email, name: identity.name, role: identity.role, branchIds: identity.branchIds, access: await compactAccessSnapshot(env,identity.email) });
    }
    if (url.pathname === "/v1/admin/reproject" && request.method === "POST") {
      if (identity.role !== "Owner") return json({ error: "Khusus Owner" }, 403);
      const row = await env.DB.prepare("SELECT revision,payload_json FROM sync_snapshots WHERE organization_id=?").bind(ORG_ID).first<{revision:number;payload_json:string}>();
      if (!row) return json({ error: "Snapshot belum tersedia" }, 404);
      const materialized=await materializedSnapshot(env,row);
      // Versi tabel normalisasi harus memakai revisi jurnal terbaru, bukan revisi
      // baris snapshot yang bisa tertinggal jauh. Memakai revisi lama membuat
      // updated_at entity mundur dan OCC menolak perubahan perangkat.
      const journal=await env.DB.prepare("SELECT COALESCE(MAX(sequence),0) AS revision FROM sync_changes WHERE organization_id=?").bind(ORG_ID).first<{revision:number}>();
      const version=Math.max(row.revision, materialized.revision, journal?.revision ?? 0);
      await projectSnapshot(env, materialized.snapshot, version);
      await env.DB.prepare("UPDATE sync_snapshots SET revision=? WHERE organization_id=? AND revision<=?").bind(version,ORG_ID,version).run();
      return json({ ok: true, revision: version, syncRevision:materialized.revision });
    }
    if ((url.pathname === "/api/cuciin" || url.pathname === "/v1/snapshot") && request.method === "GET") {
      const materialized=await materializedSnapshot(env);
      return new Response(JSON.stringify(visibleSnapshot(materialized.snapshot, identity)), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options":"nosniff", "X-Cuciin-Revision":String(materialized.revision), "X-Cuciin-Scope":syncScopeKey(identity) } });
    }
    if ((url.pathname === "/api/cuciin" || url.pathname === "/v1/snapshot") && request.method === "PUT") return await putSnapshot(request, env, identity);
    if (url.pathname === "/v1/sync/commands" && request.method === "POST") return pushCommands(request, env, identity);
    if (url.pathname === "/v1/sync/changes" && request.method === "GET") return pullChanges(request, env, identity);
    if (url.pathname === "/v1/reports/cashier-services" && request.method === "GET") return report(request, env, identity);
    return json({ error: "Rute tidak ditemukan" }, 404);
    } catch(error) {
      if(error instanceof Error && error.message.startsWith("snapshot_recovery_required:")) return json({code:"snapshot_recovery_required",error:"Cache dan jurnal tidak konsisten; pemulihan server harus diverifikasi"},503);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
