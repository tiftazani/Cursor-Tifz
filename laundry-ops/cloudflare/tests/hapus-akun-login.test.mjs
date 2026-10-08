/**
 * Uji penghapusan akun login saat user dihapus dari daftar.
 *
 * Ini penutup akar masalah yang dilaporkan seorang user: dia tidak bisa mendaftar. Sebabnya,
 * menghapus user hanya menghapus barisnya di D1, sedangkan akun loginnya tertinggal di Firebase.
 * Emailnya jadi terkunci: tidak bisa masuk karena barisnya sudah hilang, tidak bisa daftar ulang
 * karena `EMAIL_EXISTS`.
 *
 * Dua hal yang paling penting dijaga di sini:
 *
 * 1. Kegagalan menghapus akun login TIDAK BOLEH menggagalkan command `staff.delete`. Command yang
 *    gagal memacetkan antrean perangkat, dan itu lebih parah daripada satu akun tertinggal.
 * 2. Tanpa kunci admin, penghapusan user tetap berjalan seperti sebelumnya. Tidak ada perangkat
 *    yang boleh rusak hanya karena secret belum dipasang.
 *
 * Kripto diuji sungguhan: kunci RSA dibuat di dalam uji, ditandatangani, lalu dipakai untuk
 * menukar token. Yang dipalsukan hanya jawaban jaringan dari Google.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { fakeD1, identities, commandRequest, rows, seedBaseline } from "./support/d1-harness.mjs";
import { pushCommands } from "../src/command-sync.ts";
import { serviceAccount, tokenAkses, hapusAkunLogin } from "../src/firebase-admin.ts";

async function kunciUji() {
  const pasangan = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pasangan.privateKey));
  let biner = "";
  for (const byte of pkcs8) biner += String.fromCharCode(byte);
  const badan = btoa(biner).replace(/(.{64})/g, "$1\n");
  return `-----BEGIN PRIVATE KEY-----\n${badan}\n-----END PRIVATE KEY-----\n`;
}

const AKUN_UJI = {
  client_email: "firebase-adminsdk-fbsvc@cuciin-ops.iam.gserviceaccount.com",
  private_key: "",
  token_uri: "https://oauth2.googleapis.com/token",
  project_id: "cuciin-ops",
};

/** Ganti fetch jaringan dengan jawaban yang dicatat, lalu kembalikan lagi. */
async function denganFetchPalsu(jawaban, jalan) {
  const asli = globalThis.fetch;
  const panggilan = [];
  globalThis.fetch = async (url, opsi = {}) => {
    panggilan.push({ url: String(url), body: opsi.body ? String(opsi.body) : "" });
    const hasil = jawaban(String(url), opsi);
    if (hasil instanceof Error) throw hasil;
    return new Response(JSON.stringify(hasil.body), { status: hasil.status ?? 200 });
  };
  try {
    await jalan(panggilan);
  } finally {
    globalThis.fetch = asli;
  }
}

// ---- pembacaan kunci ----

test("kunci service account dibaca dari JSON mentah", () => {
  const akun = serviceAccount({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ ...AKUN_UJI, private_key: "kunci-uji" }) });
  assert.equal(akun?.client_email, AKUN_UJI.client_email);
});

test("kunci service account dibaca dari base64", () => {
  const akun = serviceAccount({ FIREBASE_SERVICE_ACCOUNT: btoa(JSON.stringify({ ...AKUN_UJI, private_key: "kunci-uji" })) });
  assert.equal(akun?.project_id, "cuciin-ops");
});

test("kunci tanpa private_key dianggap tidak ada", () => {
  // Kunci aplikasi (bukan service account) tidak boleh dipakai: ia hanya berwenang atas akunnya
  // sendiri, bukan menghapus akun orang lain.
  assert.equal(serviceAccount({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(AKUN_UJI) }), null);
});

test("tanpa kunci, tidak ada yang dikembalikan", () => {
  assert.equal(serviceAccount({}), null);
  assert.equal(serviceAccount({ FIREBASE_SERVICE_ACCOUNT: "  " }), null);
  assert.equal(serviceAccount({ FIREBASE_SERVICE_ACCOUNT: "bukan json" }), null);
});

// ---- penukaran token ----

test("token akses ditukar dengan tanda tangan asli", async () => {
  const akun = { ...AKUN_UJI, private_key: await kunciUji() };
  await denganFetchPalsu(
    () => ({ body: { access_token: "token-uji" } }),
    async (panggilan) => {
      const token = await tokenAkses(akun);
      assert.equal(token, "token-uji");
      assert.match(panggilan[0].url, /oauth2\.googleapis\.com\/token/);
      // Klaim harus memuat scope identitas dan alamat penerima yang benar.
      const klaim = JSON.parse(atob(panggilan[0].body.split("assertion=")[1].split("&")[0].replace(/-/g, "+").replace(/_/g, "/").split(".")[1]));
      assert.equal(klaim.iss, AKUN_UJI.client_email);
      assert.equal(klaim.aud, AKUN_UJI.token_uri);
      assert.match(klaim.scope, /identitytoolkit/);
    },
  );
});

test("token yang ditolak Google dilaporkan sebagai kegagalan", async () => {
  const akun = { ...AKUN_UJI, private_key: await kunciUji() };
  await denganFetchPalsu(
    () => ({ status: 401, body: { error: "invalid_grant" } }),
    async () => {
      await assert.rejects(() => tokenAkses(akun), /Token admin ditolak/);
    },
  );
});

// ---- penghapusan akun ----

test("akun login dicari lalu dihapus", async () => {
  const akun = { ...AKUN_UJI, private_key: await kunciUji() };
  await denganFetchPalsu(
    (url) =>
      url.includes("/token")
        ? { body: { access_token: "token-uji" } }
        : url.includes("accounts:lookup")
          ? { body: { users: [{ localId: "uid-1" }] } }
          : { body: {} },
    async (panggilan) => {
      const hasil = await hapusAkunLogin({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(akun) }, "kasir@cuciin.id");
      assert.equal(hasil, "akun login dihapus");
      assert.equal(panggilan.length, 3); // token, lookup, delete
      assert.match(panggilan[1].body, /kasir@cuciin\.id/);
      assert.match(panggilan[2].body, /uid-1/);
    },
  );
});

test("akun yang sudah tidak ada bukan kegagalan", async () => {
  const akun = { ...AKUN_UJI, private_key: await kunciUji() };
  await denganFetchPalsu(
    (url) => (url.includes("/token") ? { body: { access_token: "token-uji" } } : { body: {} }),
    async () => {
      const hasil = await hapusAkunLogin({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(akun) }, "kasir@cuciin.id");
      assert.equal(hasil, "tidak ada akun login");
    },
  );
});

test("tanpa kunci, penghapusan dilewati tanpa melempar", async () => {
  assert.equal(await hapusAkunLogin({}, "kasir@cuciin.id"), "dilewati: kunci admin belum dipasang");
});

test("kegagalan jaringan dilaporkan, bukan dilempar", async () => {
  const akun = { ...AKUN_UJI, private_key: await kunciUji() };
  await denganFetchPalsu(
    () => new Error("jaringan putus"),
    async () => {
      const hasil = await hapusAkunLogin({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(akun) }, "kasir@cuciin.id");
      assert.match(hasil, /^gagal: /);
    },
  );
});

// ---- command staff.delete ----

const IDENTITAS = { ...identities.owner };

async function hapusUser(env, email, akun = {}) {
  // Bentuk kiriman mengikuti aplikasi: `entityType` + `operation`, bukan nama tipe langsung.
  // Itu penting supaya uji ini memeriksa jalur yang benar-benar dipakai perangkat.
  const perintah = {
    // commandId hanya boleh huruf, angka, titik, titik dua, dan tanda hubung.
    commandId: `hapus-${email.replace(/[^a-z0-9]/gi, "-")}-${Math.random().toString(36).slice(2, 10)}`,
    entityType: "staff",
    entityId: email,
    operation: "delete",
  };
  const jawaban = await pushCommands(commandRequest([perintah]), { ...env, ...akun }, IDENTITAS);
  const body = await jawaban.json();
  return { status: jawaban.status, body, hasil: body.results?.[0] };
}

test("hapus user tetap berhasil walau kunci admin belum dipasang", async () => {
  const env = fakeD1();
  seedBaseline(env);
  const { status, hasil } = await hapusUser(env, "kasir@cuciin.id");
  assert.equal(status, 200);
  assert.equal(hasil?.accepted, true, JSON.stringify(hasil));
  assert.equal(rows(env, "SELECT email FROM staff WHERE email=?", "kasir@cuciin.id").length, 0);
});

test("kunci admin rusak tidak menggagalkan penghapusan user", async () => {
  // Kunci yang tidak bisa dipakai berarti akun loginnya PASTI tertinggal. Command tetap
  // diselesaikan (antrean tidak boleh macet), dan kegagalannya dicatat di log supaya terlihat,
  // bukan hilang tanpa jejak.
  const env = fakeD1();
  seedBaseline(env);
  const akun = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ ...AKUN_UJI, private_key: "bukan kunci" }) };
  await denganFetchPalsu(
    () => ({ body: {} }),
    async () => {
      const { status, hasil } = await hapusUser(env, "kasir@cuciin.id", akun);
      assert.equal(status, 200);
      assert.equal(hasil?.accepted, true, JSON.stringify(hasil));
    },
  );
  assert.equal(rows(env, "SELECT email FROM staff WHERE email=?", "kasir@cuciin.id").length, 0);
});

test("hapus user dengan kunci admin memanggil penghapusan akun", async () => {
  const env = fakeD1();
  seedBaseline(env);
  const akun = { ...AKUN_UJI, private_key: await kunciUji() };
  await denganFetchPalsu(
    (url) =>
      url.includes("/token")
        ? { body: { access_token: "token-uji" } }
        : url.includes("accounts:lookup")
          ? { body: { users: [{ localId: "uid-9" }] } }
          : { body: {} },
    async (panggilan) => {
      const { status } = await hapusUser(env, "kasir@cuciin.id", { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(akun) });
      assert.equal(status, 200);
      assert.ok(panggilan.some((p) => p.url.includes("accounts:lookup")), "akun login harus dicari");
      assert.ok(panggilan.some((p) => p.url.includes("accounts:delete")), "akun login harus dihapus");
    },
  );
  assert.equal(rows(env, "SELECT email FROM staff WHERE email=?", "kasir@cuciin.id").length, 0);
});
