-- Ganti nama Owner menjadi nama netral.
--
-- Aplikasi ini dijual ke banyak pemilik laundry, jadi nama yang tampil di layar harus netral.
-- Nama pribadi hanya boleh hidup di alamat email, karena itu identitas akun Firebase yang
-- tidak bisa diganti tanpa memutus login semua perangkat.
--
-- KENAPA LEWAT JURNAL, BUKAN HANYA UPDATE TABEL:
-- Snapshot yang dibaca perangkat dibentuk dari snapshot tersimpan plus jurnal `sync_changes`.
-- Kalau hanya tabel `staff` yang diubah, perangkat yang sudah memegang salinan akan tetap
-- menampilkan nama lama sampai ada perubahan lain pada baris yang sama.
--
-- KENAPA SATU ENTRI PER CABANG:
-- `pullChanges` di command-sync.ts menyaring jurnal untuk pengguna non-Owner dengan
-- `branch_id IN (cabang pengguna)`, dan entri `staff` hanya lolos bila cabangnya cocok.
-- `staffJournalScopes` di kode Worker karena itu menulis satu entri per cabang
-- (`upserts: after`). Migrasi ini mengikuti aturan yang sama. Kalau hanya satu entri ditulis,
-- kasir dan SPV di cabang lain tidak akan pernah menerima nama baru, walaupun Owner melihatnya.
--
-- IDEMPOTENSI:
-- Tidak ada indeks unik pada `sync_changes`, jadi `INSERT OR IGNORE` tidak menjamin apa pun di
-- sini. Penjagaan memakai `NOT EXISTS` yang membandingkan command_id DAN branch_id sekaligus.
-- Dijalankan dua kali tidak menggandakan entri.
--
-- URUTAN: pernyataan tabel dijalankan lebih dulu, lalu pernyataan jurnal membaca nama yang
-- sudah baru, sehingga tabel dan payload selalu sejalan.

-- 1. Ganti nama di tabel staff.
UPDATE staff
SET name = 'Cuciin',
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE lower(email) = 'tiftazani.khara@gmail.com'
  AND name <> 'Cuciin';

-- 2a. Satu entri jurnal untuk tiap cabang tempat Owner ditugaskan.
INSERT INTO sync_changes(
  organization_id, entity_type, entity_id, operation, payload_json,
  updated_at, branch_id, actor_email, command_id
)
SELECT
  'cuciin',
  'staff',
  lower(s.email),
  'upsert',
  json_object(
    'name', s.name,
    'email', s.email,
    'role', s.role,
    'branchIds', json(COALESCE(
      (SELECT json_group_array(sb2.branch_id)
       FROM staff_branches sb2
       WHERE lower(sb2.staff_email) = lower(s.email)),
      '[]')),
    'approved', json(CASE WHEN s.approved = 1 THEN 'true' ELSE 'false' END),
    'accessRoleId', '',
    'id', lower(s.email),
    'updatedAt', s.updated_at
  ),
  s.updated_at,
  sb.branch_id,
  'system',
  'owner-name-neutral-v1'
FROM staff s
JOIN staff_branches sb ON lower(sb.staff_email) = lower(s.email)
WHERE lower(s.email) = 'tiftazani.khara@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM sync_changes sc
    WHERE sc.command_id = 'owner-name-neutral-v1'
      AND sc.branch_id = sb.branch_id
  );

-- 2b. Bila Owner belum ditugaskan ke cabang mana pun, tulis satu entri tanpa cabang supaya
--     tidak ada keadaan yang membuat perangkat tidak menerima perubahan sama sekali.
INSERT INTO sync_changes(
  organization_id, entity_type, entity_id, operation, payload_json,
  updated_at, branch_id, actor_email, command_id
)
SELECT
  'cuciin',
  'staff',
  lower(s.email),
  'upsert',
  json_object(
    'name', s.name,
    'email', s.email,
    'role', s.role,
    'branchIds', json('[]'),
    'approved', json(CASE WHEN s.approved = 1 THEN 'true' ELSE 'false' END),
    'accessRoleId', '',
    'id', lower(s.email),
    'updatedAt', s.updated_at
  ),
  s.updated_at,
  NULL,
  'system',
  'owner-name-neutral-v1'
FROM staff s
WHERE lower(s.email) = 'tiftazani.khara@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM staff_branches sb
    WHERE lower(sb.staff_email) = lower(s.email)
  )
  AND NOT EXISTS (
    SELECT 1 FROM sync_changes sc
    WHERE sc.command_id = 'owner-name-neutral-v1'
      AND sc.branch_id IS NULL
  );
