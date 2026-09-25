-- Fixture untuk menguji bahwa perapi MENOLAK berkas yang tidak bisa diselamatkan.
--
-- `INSERT INTO attendance` menunjuk tabel yang tidak pernah dibuat. Tidak ada urutan
-- pernyataan yang bisa membuat ini berhasil, jadi perapi harus berhenti dengan kode
-- keluar bukan-nol SEBELUM database cadangan disentuh.
CREATE TABLE staff (
  email TEXT PRIMARY KEY
);
INSERT INTO "staff" ("email") VALUES('kasir@contoh.id');
INSERT INTO "attendance" ("id","staff_email") VALUES('att-1','kasir@contoh.id');
