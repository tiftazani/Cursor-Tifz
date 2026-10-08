/**
 * Menghapus akun login Firebase saat user dihapus dari daftar.
 *
 * Kenapa ini ada: menghapus user hanya menghapus barisnya di D1. Akun loginnya tertinggal di
 * Firebase, sehingga emailnya terkunci — orang itu tidak bisa masuk (barisnya sudah hilang) dan
 * tidak bisa mendaftar ulang (`EMAIL_EXISTS`). Persis itu yang dilaporkan seorang user.
 *
 * Modul ini memakai kunci service account, bukan kunci aplikasi. Kunci aplikasi hanya boleh
 * dipakai pemilik akun itu sendiri; menghapus akun orang lain butuh kunci admin. Kuncinya
 * disimpan sebagai secret Worker (`FIREBASE_SERVICE_ACCOUNT`), tidak pernah ikut ke dalam APK.
 *
 * Aturan penting: kegagalan di sini TIDAK BOLEH menggagalkan penghapusan user. Baris di D1 sudah
 * terhapus dan itu yang dilihat aplikasi; akun yang tertinggal masih bisa dibereskan belakangan,
 * sedangkan command yang gagal akan memacetkan antrean perangkat.
 */

export interface AkunEnv {
  FIREBASE_SERVICE_ACCOUNT?: string;
}

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
  project_id?: string;
};

const SCOPE = "https://www.googleapis.com/auth/identitytoolkit";

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const byte of raw) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemKeDer(pem: string): Uint8Array {
  const isi = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const biner = atob(isi);
  return Uint8Array.from(biner, (c) => c.charCodeAt(0));
}

/** Baca service account dari secret. Nilainya JSON utuh, atau base64 dari JSON itu. */
export function serviceAccount(env: AkunEnv): ServiceAccount | null {
  const mentah = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!mentah) return null;
  for (const teks of [mentah, amanAtob(mentah)]) {
    if (!teks) continue;
    try {
      const akun = JSON.parse(teks) as ServiceAccount;
      if (akun.client_email && akun.private_key) return akun;
    } catch {
      // Coba bentuk berikutnya.
    }
  }
  return null;
}

function amanAtob(teks: string): string {
  try {
    return atob(teks);
  } catch {
    return "";
  }
}

/**
 * Tukar kunci service account dengan token akses OAuth2.
 *
 * Token berlaku satu jam; setiap panggilan meminta yang baru. Ini panggilan yang jarang terjadi
 * (hanya saat user dihapus), jadi menyimpan token tidak sepadan dengan tambahan kode dan
 * kemungkinan token basi.
 */
export async function tokenAkses(akun: ServiceAccount, now = Date.now()): Promise<string> {
  const tokenUri = akun.token_uri ?? "https://oauth2.googleapis.com/token";
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: akun.client_email,
      scope: SCOPE,
      aud: tokenUri,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    }),
  );
  const kunci = await crypto.subtle.importKey(
    "pkcs8",
    pemKeDer(akun.private_key ?? "").buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const tandaTangan = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    kunci,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${b64url(new Uint8Array(tandaTangan))}`;
  const jawaban = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!jawaban.ok) throw new Error(`Token admin ditolak: ${jawaban.status} ${await jawaban.text()}`);
  const isi = (await jawaban.json()) as { access_token?: string };
  if (!isi.access_token) throw new Error("Jawaban token tidak memuat access_token");
  return isi.access_token;
}

async function panggilanAdmin(path: string, token: string, body: unknown): Promise<JsonRecord> {
  const jawaban = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!jawaban.ok) throw new Error(`Panggilan admin ${path} gagal: ${jawaban.status} ${await jawaban.text()}`);
  return (await jawaban.json()) as JsonRecord;
}

type JsonRecord = Record<string, unknown>;

/**
 * Hapus akun login milik sebuah email.
 *
 * Mengembalikan keterangan singkat untuk dicatat, bukan melempar kesalahan: pemanggilnya tidak
 * boleh gagal gara-gara ini.
 */
export async function hapusAkunLogin(env: AkunEnv, email: string, now = Date.now()): Promise<string> {
  const akun = serviceAccount(env);
  if (!akun) return "dilewati: kunci admin belum dipasang";
  const surel = email.trim().toLowerCase();
  if (!surel) return "dilewati: email kosong";
  try {
    const token = await tokenAkses(akun, now);
    const cari = await panggilanAdmin("lookup", token, { email: [surel] });
    const users = Array.isArray(cari.users) ? (cari.users as Array<{ localId?: string }>) : [];
    if (!users.length) return "tidak ada akun login";
    const localId = users[0].localId;
    if (!localId) return "akun tanpa localId";
    await panggilanAdmin("delete", token, { localId });
    return "akun login dihapus";
  } catch (error) {
    return `gagal: ${error instanceof Error ? error.message : String(error)}`;
  }
}
