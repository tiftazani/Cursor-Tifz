-- Absensi per cabang: satu karyawan boleh absen di lebih dari satu cabang dalam sehari.
--
-- KENAPA:
-- Kasir yang ditugaskan ke dua cabang sebelumnya hanya bisa absen di satu cabang saja.
-- Penyebabnya ada dua lapis, dan migrasi ini memperbaiki lapis datanya:
--
--   1. Tabel `attendance` memakai UNIQUE (staff_email, work_date). Satu baris per karyawan
--      per hari, sehingga absen kedua di cabang lain ditolak basis data.
--   2. Aplikasi menyimpan hanya satu cabang pada `Session` dan menolak `checkIn` bila
--      cabangnya bukan cabang itu. Itu diperbaiki di sisi aplikasi.
--
-- Sesudah migrasi ini kuncinya menjadi (staff_email, work_date, branch_id): satu catatan
-- per karyawan, per hari, per cabang. Orang yang pagi di Bunayya dan sore di Laupay Kirab
-- punya dua baris, masing-masing dengan jam masuk dan pulangnya sendiri.
--
-- KENAPA REBUILD TABEL, BUKAN ALTER:
-- SQLite tidak dapat mengubah daftar kolom sebuah UNIQUE constraint lewat ALTER TABLE.
-- Satu-satunya jalan adalah membuat tabel baru, menyalin isinya, lalu menggantinya.
--
-- AMAN TERHADAP DATA:
-- Tidak ada tabel lain yang mereferensikan `attendance` (tidak ada foreign key yang menunjuk
-- ke sini), jadi mengganti namanya tidak memutus relasi apa pun. Seluruh baris disalin apa
-- adanya; tidak ada kolom yang dibuang dan tidak ada nilai yang diubah.
--
-- IDEMPOTENSI:
-- Migrasi D1 dijalankan sekali dan dicatat di `d1_migrations`, jadi tabel baru hanya dibuat
-- bila belum ada. Penjagaan `IF NOT EXISTS` di bawah menjaga migrasi ini tetap aman bila
-- dijalankan ulang secara manual di database debug.

-- 1. Tabel pengganti dengan kunci unik per cabang.
CREATE TABLE IF NOT EXISTS attendance_baru (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  staff_email TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  work_date TEXT NOT NULL,
  check_in_at INTEGER NOT NULL,
  check_out_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE (staff_email, work_date, branch_id)
);

-- 2. Salin seluruh baris lama. `INSERT OR IGNORE` melindungi dari kemungkinan data lama yang
--    sudah punya dua baris untuk (karyawan, tanggal, cabang) yang sama.
INSERT OR IGNORE INTO attendance_baru
  (id, organization_id, branch_id, staff_email, staff_name, work_date, check_in_at, check_out_at, note, updated_at)
SELECT
  id, organization_id, branch_id, staff_email, staff_name, work_date, check_in_at, check_out_at, note, updated_at
FROM attendance;

-- 3. Ganti tabel lama.
DROP TABLE attendance;
ALTER TABLE attendance_baru RENAME TO attendance;

-- 4. Bangun ulang indeks. Indeks ikut terhapus bersama tabel lama.
CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance(branch_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_email, work_date DESC);
-- Indeks baru: pencarian "absensi saya hari ini di cabang ini" adalah kueri paling sering
-- dipakai layar Absensi karyawan, dan sekarang cabangnya ikut menentukan.
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date_branch ON attendance(staff_email, work_date, branch_id);
