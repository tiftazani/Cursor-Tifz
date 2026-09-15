-- Produk retail memiliki relasi eksplisit ke katalog stok; kecocokan nama tetap dipakai untuk riwayat lama.
ALTER TABLE services ADD COLUMN product_id TEXT REFERENCES products(id);
ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'BahanHabisPakai';
ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'pcs';

-- Pengaturan bisnis disimpan sebagai data organisasi agar semua perangkat memakai aturan yang sama.
CREATE TABLE access_policies (
  email TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (email, organization_id)
);

CREATE TABLE whatsapp_templates (
  id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (id, organization_id)
);

CREATE INDEX idx_services_product ON services(organization_id, product_id);
