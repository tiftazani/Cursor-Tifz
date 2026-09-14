# Struktur RDBMS Cuciin

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ BRANCHES : memiliki
    ORGANIZATIONS ||--o{ STAFF : mempekerjakan
    STAFF ||--o{ STAFF_BRANCHES : ditugaskan
    BRANCHES ||--o{ STAFF_BRANCHES : mencakup
    ORGANIZATIONS ||--o{ CUSTOMERS : melayani
    ORGANIZATIONS ||--o{ SERVICES : menawarkan
    ORGANIZATIONS ||--o{ PRODUCTS : memiliki
    BRANCHES ||--o{ BRANCH_STOCKS : menyimpan
    PRODUCTS ||--o{ BRANCH_STOCKS : bersaldo
    BRANCHES ||--o{ ORDERS : menerbitkan
    ORDERS ||--|{ ORDER_LINES : merinci
    SERVICES ||--o{ ORDER_LINES : direferensikan
    BRANCHES ||--o{ ATTENDANCE : mencatat
    BRANCHES ||--o{ INVENTORY_ITEMS : memiliki
    BRANCHES ||--o{ EXPENSES : membebankan
    BRANCHES ||--o{ STOCK_MOVES : memutasi
    BRANCHES ||--o{ CASH_CLOSES : menutup_kas
    ORDERS ||--o{ AUDIT_LOGS : diaudit
    ORGANIZATIONS ||--|| SYNC_SNAPSHOTS : kompatibilitas
    ORGANIZATIONS ||--o{ SYNC_CHANGES : jurnal_perubahan
    ORGANIZATIONS ||--o{ PROCESSED_COMMANDS : idempotensi
```

Pusat transaksi berada pada `orders` dan `order_lines`. Setiap order menyimpan cabang serta kasir pembuat; setiap baris menyimpan layanan, harga aktual nota, petugas yang menangani, dan tarif komisi pada saat transaksi. Karena tarif disalin ke baris transaksi, perubahan harga atau komisi katalog tidak mengubah laporan historis.

Stok memakai katalog `products` dan saldo gabungan `(branch_id, product_id)` pada `branch_stocks`. Mesin dan aset lain berada pada `inventory_items` per cabang. `expenses`, `attendance`, `cash_closes`, `stock_moves`, dan `audit_logs` juga membawa cabang sehingga laporan dapat difilter dengan indeks.

`sync_snapshots` menjaga kompatibilitas aplikasi Android local-first saat ini. `sync_changes` dan `processed_commands` disediakan untuk migrasi ke sinkronisasi mutasi per baris dan idempotensi. Sebelum dua puluh cabang menulis bersamaan, kontrak Android perlu dipindahkan penuh ke jurnal mutasi ini agar konflik tidak bergantung pada versi snapshot global.
