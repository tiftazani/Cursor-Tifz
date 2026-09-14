PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  maps_query TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE staff (
  email TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner','Kasir','Supervisor')),
  approved INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE staff_branches (
  staff_email TEXT NOT NULL REFERENCES staff(email) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_email, branch_id)
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  default_price INTEGER NOT NULL CHECK (default_price >= 0),
  commission_per_unit INTEGER NOT NULL DEFAULT 0 CHECK (commission_per_unit >= 0),
  retail INTEGER NOT NULL DEFAULT 0,
  drop_out INTEGER NOT NULL DEFAULT 0,
  self_service INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  cashier_email TEXT NOT NULL DEFAULT '',
  cashier_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL CHECK (total >= 0),
  paid INTEGER NOT NULL CHECK (paid >= 0),
  payment_status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  work_status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  estimated_finish TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  picked_up_at TEXT,
  wa_sent INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE order_lines (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  handler_email TEXT NOT NULL DEFAULT '',
  handler_name TEXT NOT NULL DEFAULT '',
  commission_per_unit INTEGER NOT NULL DEFAULT 0 CHECK (commission_per_unit >= 0),
  PRIMARY KEY (order_id, line_no)
);

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  staff_email TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  work_date TEXT NOT NULL,
  check_in_at INTEGER NOT NULL,
  check_out_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE (staff_email, work_date)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE branch_stocks (
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (branch_id, product_id)
);

CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  occurred_at INTEGER NOT NULL,
  officer TEXT NOT NULL,
  note TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE stock_moves (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  payload_json TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  order_id TEXT,
  occurred_at INTEGER NOT NULL
);

CREATE TABLE cash_closes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  payload_json TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sync_snapshots (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id),
  revision INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sync_changes (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert','delete')),
  payload_json TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE processed_commands (
  command_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  processed_at INTEGER NOT NULL
);

CREATE INDEX idx_orders_branch_time ON orders(branch_id, created_at DESC);
CREATE INDEX idx_orders_cashier_time ON orders(cashier_email, created_at DESC);
CREATE INDEX idx_order_lines_handler ON order_lines(handler_email, service_id);
CREATE INDEX idx_attendance_branch_date ON attendance(branch_id, work_date DESC);
CREATE INDEX idx_attendance_staff_date ON attendance(staff_email, work_date DESC);
CREATE INDEX idx_expenses_branch_time ON expenses(branch_id, occurred_at DESC);
CREATE INDEX idx_audit_branch_time ON audit_logs(branch_id, occurred_at DESC);
CREATE INDEX idx_sync_changes_org_seq ON sync_changes(organization_id, sequence);
