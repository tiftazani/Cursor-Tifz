-- Sinkronisasi command/delta untuk banyak perangkat. Kolom baru dibuat nullable
-- agar database yang sudah berisi journal versi awal tetap dapat dimigrasikan.
ALTER TABLE sync_changes ADD COLUMN branch_id TEXT;
ALTER TABLE sync_changes ADD COLUMN actor_email TEXT;
ALTER TABLE sync_changes ADD COLUMN command_id TEXT;

ALTER TABLE processed_commands ADD COLUMN command_type TEXT;
ALTER TABLE processed_commands ADD COLUMN actor_email TEXT;
ALTER TABLE processed_commands ADD COLUMN request_hash TEXT;
ALTER TABLE processed_commands ADD COLUMN execution_token TEXT;
ALTER TABLE processed_commands ADD COLUMN result_json TEXT;

-- Salinan payload kanonis menjaga field tampilan Nota yang tidak menjadi kolom
-- laporan (mis. items/dropOut) dan dipakai untuk validasi perubahan status SPV.
ALTER TABLE orders ADD COLUMN payload_json TEXT;

CREATE INDEX idx_sync_changes_branch_seq
  ON sync_changes(organization_id, branch_id, sequence);
CREATE INDEX idx_processed_commands_org_time
  ON processed_commands(organization_id, processed_at DESC);

-- Baris ini hanya hidup selama satu D1 batch. CHECK memaksa batch rollback bila
-- optimistic update/delete tidak mengubah tepat satu baris.
CREATE TABLE sync_command_guards (
  execution_token TEXT PRIMARY KEY,
  changed_rows INTEGER NOT NULL CHECK (changed_rows = 1)
);

CREATE TRIGGER branch_stocks_nonnegative_insert
BEFORE INSERT ON branch_stocks
WHEN NEW.quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'stock_below_zero');
END;

CREATE TRIGGER branch_stocks_nonnegative_update
BEFORE UPDATE OF quantity ON branch_stocks
WHEN NEW.quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'stock_below_zero');
END;
