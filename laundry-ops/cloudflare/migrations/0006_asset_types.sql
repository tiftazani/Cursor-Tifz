-- Katalog jenis aset cabang.
--
-- Jenis aset dipakai sebagai filter daftar aset dan pembentuk Aset ID
-- (kode cabang, kode jenis, nomor urut). Katalog bersifat organisasi, bukan per cabang,
-- supaya kode jenis tetap sama di seluruh cabang.
--
-- Jenis yang sudah dipakai aset tidak dihapus; kolom active dipakai untuk menonaktifkannya
-- agar kode aset lama tetap dapat dibaca.

CREATE TABLE asset_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_types_org ON asset_types(organization_id, active);

-- Jenis bawaan supaya instalasi baru punya katalog awal tanpa menunggu seed manual.
INSERT OR IGNORE INTO asset_types(id, organization_id, code, name, active, updated_at)
SELECT 'at-mesin-cuci', id, 'MC', 'Mesin cuci', 1, 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO asset_types(id, organization_id, code, name, active, updated_at)
SELECT 'at-mesin-pengering', id, 'MP', 'Mesin pengering', 1, 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO asset_types(id, organization_id, code, name, active, updated_at)
SELECT 'at-setrika', id, 'ST', 'Setrika / steamer', 1, 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO asset_types(id, organization_id, code, name, active, updated_at)
SELECT 'at-timbangan', id, 'TB', 'Timbangan', 1, 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO asset_types(id, organization_id, code, name, active, updated_at)
SELECT 'at-peralatan', id, 'PR', 'Peralatan operasional', 1, 0 FROM organizations WHERE id = 'cuciin';
INSERT OR IGNORE INTO asset_types(id, organization_id, code, name, active, updated_at)
SELECT 'at-lainnya', id, 'LN', 'Lainnya', 1, 0 FROM organizations WHERE id = 'cuciin';
