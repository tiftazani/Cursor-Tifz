-- Bersihkan data transaksi & keuangan di D1 PRODUKSI (cuciin-db).
--
-- Perintah Owner: "Data transaksi, data keuangan di database produksi (aplikasi
-- release) belum dihapus; hapus semuanya, hanya pertahankan data user (kasir, spv,
-- owner) dan data cabang saja."
--
-- DIPERTAHANKAN (tidak disentuh berkas ini):
--   staff, staff_branches, branches, access_roles, access_policies,
--   organizations, d1_migrations
--
-- DIHAPUS: seluruh transaksi, keuangan, katalog operasional, dan jejak sinkronisasi.
-- `services` dan `asset_types` ikut dihapus karena keduanya data operasional, bukan
-- user/cabang; kalau Owner ingin katalog layanan tetap ada, jalankan ulang migrasi
-- seed layanan sesudah ini.
--
-- Urutan DELETE menghormati foreign key: anak dulu, induk kemudian.
-- PRAGMA defer_foreign_keys dipakai supaya pemeriksaan FK ditunda sampai akhir
-- transaksi pernyataan, sehingga urutan tidak bisa menggagalkan proses di tengah.
--
-- Tidak ada tombstone `sync_changes` yang ditulis: tabel itu justru dikosongkan,
-- sehingga perangkat menarik dari kursor bersih (`revision: 0`) dan tidak
-- menghidupkan kembali data lama.

PRAGMA defer_foreign_keys = TRUE;

DELETE FROM `order_lines`;
DELETE FROM `payments`;
DELETE FROM `cash_closes`;
DELETE FROM `expenses`;
DELETE FROM `orders`;
DELETE FROM `customers`;

DELETE FROM `stock_moves`;
DELETE FROM `branch_stocks`;
DELETE FROM `inventory_items`;
DELETE FROM `products`;

DELETE FROM `attendance`;
DELETE FROM `audit_logs`;
DELETE FROM `whatsapp_templates`;
DELETE FROM `asset_types`;
DELETE FROM `services`;

-- Jejak sinkronisasi: perangkat harus mulai dari kursor bersih.
DELETE FROM `processed_commands`;
DELETE FROM `sync_changes`;
DELETE FROM `sync_command_guards`;
DELETE FROM `sync_snapshots`;
