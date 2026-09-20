-- Pembersihan data produksi Cuciin.
-- Yang DIPERTAHANKAN: staff (user + Owner), branches (cabang), services (layanan).
-- Sisanya dibuang supaya APK rilis mulai dari keadaan bersih tanpa transaksi.
-- Cadangan sebelum jalan: cuciin-prod-preBersih-20260920T173214Z.sql
--
-- Urutan penting: anak dulu, induk belakangan, supaya tidak melanggar foreign key.

-- Anak-anak transaksi
DELETE FROM order_lines;
DELETE FROM payments;
DELETE FROM stock_moves;
DELETE FROM branch_stocks;
DELETE FROM attendance;

-- Induk transaksi
DELETE FROM orders;
DELETE FROM cash_closes;
DELETE FROM expenses;
DELETE FROM inventory_items;
DELETE FROM customers;

-- Catatan dan katalog yang bukan permintaan
DELETE FROM audit_logs;
DELETE FROM asset_types;
DELETE FROM whatsapp_templates;

-- Jurnal sinkronisasi: perangkat harus menarik dari kursor bersih
DELETE FROM sync_changes;
DELETE FROM processed_commands;
DELETE FROM sync_command_guards;

-- Snapshot lama masih memuat data transaksi; dikosongkan agar tidak ada yang memulihkannya.
DELETE FROM sync_snapshots;
