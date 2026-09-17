-- Katalog role akses.
--
-- Setiap pengguna melekat pada satu role, dan role menentukan modul serta fungsi yang
-- diizinkan. Role bawaan (Owner, Supervisor, Kasir) tidak dapat dihapus supaya peran lama
-- tetap bekerja; hanya hak aksesnya yang boleh diubah.
--
-- Payload modul dan fungsi disimpan sebagai JSON agar penambahan modul baru tidak
-- memerlukan perubahan skema.

CREATE TABLE access_roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  built_in INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_access_roles_org ON access_roles(organization_id);

-- Role bawaan supaya instalasi baru punya katalog tanpa menunggu seed manual.
-- Payload sengaja dikosongkan: aplikasi memakai katalog bawaannya bila payload tidak memuat
-- daftar modul, sehingga daftar modul baru otomatis ikut terpakai.
INSERT OR IGNORE INTO access_roles(id, organization_id, name, built_in, payload_json, updated_at)
SELECT 'role-owner', id, 'Owner', 1, '{"id":"role-owner","name":"Owner","builtIn":true}', 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO access_roles(id, organization_id, name, built_in, payload_json, updated_at)
SELECT 'role-supervisor', id, 'Supervisor', 1, '{"id":"role-supervisor","name":"Supervisor","builtIn":true}', 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO access_roles(id, organization_id, name, built_in, payload_json, updated_at)
SELECT 'role-kasir', id, 'Kasir', 1, '{"id":"role-kasir","name":"Kasir","builtIn":true}', 0 FROM organizations WHERE id = 'cuciin';
