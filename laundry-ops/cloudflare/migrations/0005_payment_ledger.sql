-- Jurnal pembayaran bersifat append-only. Saldo kas dihitung dari baris ini,
-- sehingga pembayaran bertahap tidak dipindahkan ke tanggal nota dibuat.
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('Tunai','Qris','Transfer')),
  received_at INTEGER NOT NULL,
  received_by TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_payments_branch_received ON payments(organization_id, branch_id, received_at DESC);
CREATE INDEX idx_payments_order ON payments(order_id);