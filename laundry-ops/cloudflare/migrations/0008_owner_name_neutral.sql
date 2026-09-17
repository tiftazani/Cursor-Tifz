-- Ganti nama Owner menjadi nama netral.
--
-- Aplikasi ini dijual ke banyak pemilik laundry, jadi nama yang tampil di layar harus netral.
-- Nama pribadi hanya boleh hidup di alamat email, karena itu identitas akun Firebase yang
-- tidak bisa diganti tanpa memutus login semua perangkat.
--
-- Perubahan nama harus lewat jurnal `sync_changes`, bukan hanya UPDATE tabel, karena snapshot
-- yang dibaca perangkat dibentuk dari snapshot tersimpan plus jurnal. Kalau tabel saja yang
-- diubah, perangkat yang sudah punya salinan akan tetap menampilkan nama lama sampai ada
-- perubahan lain pada baris yang sama.
--
-- Idempoten: dijalankan dua kali tidak menggandakan entri jurnal, karena command_id-nya sama
-- dan sudah dijaga indeks unik.

-- 1. Ganti nama di tabel staff.
UPDATE staff
SET name = 'Cuciin',
    updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE lower(email) = 'tiftazani.khara@gmail.com'
  AND name <> 'Cuciin';

-- 2. Catat ke jurnal supaya perangkat ikut menerima nama baru.
--    Payload disusun lengkap (role, cabang, approved) karena perangkat mengganti seluruh baris.
INSERT OR IGNORE INTO sync_changes(
  organization_id, entity_type, entity_id, operation, payload_json,
  updated_at, branch_id, actor_email, command_id
)
SELECT
  'cuciin',
  'staff',
  lower(s.email),
  'upsert',
  json_object(
    'name', 'Cuciin',
    'email', s.email,
    'role', s.role,
    'branchIds', json(COALESCE(
      (SELECT json_group_array(sb.branch_id)
       FROM staff_branches sb
       WHERE lower(sb.staff_email) = lower(s.email)),
      '[]')),
    'approved', json(CASE WHEN s.approved = 1 THEN 'true' ELSE 'false' END),
    'accessRoleId', COALESCE(
      (SELECT COALESCE(ap.payload_json, '') FROM access_policies ap
       WHERE lower(ap.email) = lower(s.email) LIMIT 1), ''),
    'id', lower(s.email),
    'updatedAt', s.updated_at
  ),
  s.updated_at,
  (SELECT sb.branch_id FROM staff_branches sb
   WHERE lower(sb.staff_email) = lower(s.email) ORDER BY sb.branch_id LIMIT 1),
  'system',
  'owner-name-neutral-v1'
FROM staff s
WHERE lower(s.email) = 'tiftazani.khara@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM sync_changes sc WHERE sc.command_id = 'owner-name-neutral-v1'
  );
