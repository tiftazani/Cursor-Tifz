-- Fixture untuk menguji scripts/reorder_d1_export.py.
--
-- Sengaja dibuat dalam urutan yang MERUSAK, meniru hasil `wrangler d1 export`:
--   1. `CREATE TABLE products` datang setelah `INSERT INTO services` yang
--      merujuk kolom `product_id`.
--   2. Baris induk `products` ditulis setelah baris anak `services`.
--   3. Baris `orders` ditulis sebelum baris `branches` yang dirujuknya.
-- Berkas seperti ini dulu membuat impor ke database cadangan berhenti dengan
-- "no such table: main.products" lalu "FOREIGN KEY constraint failed".
PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
INSERT INTO "organizations" ("id","name") VALUES('cuciin','Cuciin');
CREATE TABLE staff (
  email TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL
);
INSERT INTO "staff" ("email","organization_id","role") VALUES('kasir@contoh.id','cuciin','Kasir');
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  product_id TEXT REFERENCES products(id)
);
INSERT INTO "services" ("id","organization_id","name","product_id") VALUES('sabun','cuciin','Sabun','sabun');
INSERT INTO "services" ("id","organization_id","name","product_id") VALUES('cuci','cuciin','Cuci',NULL);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  total INTEGER NOT NULL
);
INSERT INTO "orders" ("id","branch_id","total") VALUES('o-1','b-1',15000);
CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL
);
INSERT INTO "branches" ("id","organization_id","name") VALUES('b-1','cuciin','Cabang Satu');
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL
);
INSERT INTO "products" ("id","organization_id","name") VALUES('sabun','cuciin','Sabun Cair');
CREATE INDEX idx_services_product ON services(product_id);
CREATE TRIGGER orders_total_positive
BEFORE INSERT ON orders
WHEN NEW.total < 0
BEGIN
  SELECT RAISE(ABORT, 'total negatif');
END;
