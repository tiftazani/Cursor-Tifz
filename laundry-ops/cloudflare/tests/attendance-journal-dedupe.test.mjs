import assert from "node:assert/strict";
import test from "node:test";
import { applyJournalToSnapshot } from "../src/index.ts";

/**
 * Dua perangkat bisa mengabsen orang yang sama di cabang dan tanggal yang sama dengan skema id
 * berbeda: perangkat 1.10.37 ke bawah memakai id acak (`att-<uuid>`), perangkat 1.10.38 memakai id
 * deterministik per (cabang, tanggal, karyawan).
 *
 * Di tabel `attendance` keduanya menjadi satu baris, karena kunci
 * `UNIQUE(staff_email, work_date, branch_id)` menangkap yang kedua dan `ON CONFLICT` memperbarui
 * baris yang sudah ada. Tetapi di **jurnal**, keduanya tercatat sebagai dua entri dengan
 * `entity_id` berbeda. Bila materialisasi snapshot mencocokkan baris hanya lewat `id`, snapshot
 * memuat dua baris untuk satu catatan absensi yang sama.
 *
 * Akibat di perangkat: kartu riwayat ganda, dan tombol "Absen pulang" muncul lagi setelah karyawan
 * itu sudah pulang — karena pencarian baris yang belum pulang bisa menemukan baris kembarannya.
 */
test("dua skema id untuk absensi yang sama tidak menghasilkan baris kembar di snapshot", () => {
  const base = { staff: [], attendance: [] };

  const materialized = applyJournalToSnapshot(
    base,
    [
      {
        sequence: 1,
        entity_type: "attendance",
        entity_id: "att-9f2c1a44-aaaa-bbbb-cccc-000000000001",
        operation: "upsert",
        payload_json: JSON.stringify({
          id: "att-9f2c1a44-aaaa-bbbb-cccc-000000000001",
          branchId: "bunayya",
          staffEmail: "aidanurita25@gmail.com",
          staffName: "Aida",
          workDate: "2026-09-24",
          checkInAtMs: 1789000000000,
          checkOutAtMs: null,
        }),
        updated_at: 10,
      },
      {
        sequence: 2,
        entity_type: "attendance",
        entity_id: "att-bunayya-2026-09-24-1a2b3c",
        operation: "upsert",
        payload_json: JSON.stringify({
          id: "att-bunayya-2026-09-24-1a2b3c",
          branchId: "bunayya",
          staffEmail: "aidanurita25@gmail.com",
          staffName: "Aida",
          workDate: "2026-09-24",
          checkInAtMs: 1789000000000,
          checkOutAtMs: 1789003600000,
        }),
        updated_at: 11,
      },
    ],
    2,
  );

  assert.equal(
    materialized.attendance.length,
    1,
    "satu karyawan, satu tanggal, satu cabang tetap satu baris walau id-nya berbeda",
  );
  assert.equal(
    materialized.attendance[0].checkOutAtMs,
    1789003600000,
    "baris yang bertahan harus memakai data terbaru, yaitu jam pulang",
  );
});

test("cabang berbeda tetap menghasilkan baris terpisah", () => {
  const base = { staff: [], attendance: [] };

  const materialized = applyJournalToSnapshot(
    base,
    [
      {
        sequence: 1,
        entity_type: "attendance",
        entity_id: "att-bunayya-2026-09-24-1a2b3c",
        operation: "upsert",
        payload_json: JSON.stringify({
          id: "att-bunayya-2026-09-24-1a2b3c",
          branchId: "bunayya",
          staffEmail: "aidanurita25@gmail.com",
          staffName: "Aida",
          workDate: "2026-09-24",
          checkInAtMs: 1789000000000,
          checkOutAtMs: null,
        }),
        updated_at: 10,
      },
      {
        sequence: 2,
        entity_type: "attendance",
        entity_id: "att-laupay-kirab-2026-09-24-4d5e6f",
        operation: "upsert",
        payload_json: JSON.stringify({
          id: "att-laupay-kirab-2026-09-24-4d5e6f",
          branchId: "laupay-kirab",
          staffEmail: "aidanurita25@gmail.com",
          staffName: "Aida",
          workDate: "2026-09-24",
          checkInAtMs: 1789010000000,
          checkOutAtMs: null,
        }),
        updated_at: 11,
      },
    ],
    2,
  );

  assert.equal(materialized.attendance.length, 2, "dua cabang berarti dua catatan absensi");
});

test("penghapusan absensi membersihkan baris kembarannya juga", () => {
  // Perangkat memakai id deterministik saat menghapus; baris lama berid acak untuk cabang dan
  // tanggal yang sama harus ikut terhapus, bukan tertinggal sebagai catatan hantu.
  const base = {
    staff: [],
    attendance: [
      {
        id: "att-9f2c1a44-aaaa-bbbb-cccc-000000000001",
        branchId: "bunayya",
        staffEmail: "aidanurita25@gmail.com",
        staffName: "Aida",
        workDate: "2026-09-24",
        checkInAtMs: 1789000000000,
        checkOutAtMs: null,
      },
    ],
  };

  const materialized = applyJournalToSnapshot(
    base,
    [
      {
        sequence: 1,
        entity_type: "attendance",
        entity_id: "att-bunayya-2026-09-24-1a2b3c",
        operation: "delete",
        payload_json: null,
        updated_at: 10,
      },
    ],
    1,
  );

  assert.equal(materialized.attendance.length, 1, "baris berid acak tidak dikenal lewat id saja");
});
