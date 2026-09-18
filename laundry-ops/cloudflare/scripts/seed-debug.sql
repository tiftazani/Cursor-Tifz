PRAGMA foreign_keys = ON;

INSERT INTO organizations(id, name, owner_email, created_at, updated_at)
VALUES ('cuciin', 'Cuciin Debug', 'tiftazani.khara@gmail.com', 1789610400000, 1789610400000);

INSERT INTO branches(id, organization_id, code, name, address, maps_query, active, updated_at)
VALUES ('debug-bunayya', 'cuciin', 'DEBUG', 'Cabang Debug', 'Data uji lokal', '', 1, 1789610400000);

INSERT INTO staff(email, organization_id, name, role, approved, active, firebase_uid, updated_at)
VALUES
  ('tiftazani.khara@gmail.com', 'cuciin', 'Cuciin', 'Owner', 1, 1, NULL, 1789610400000),
  ('us.archuleta1207@gmail.com', 'cuciin', 'Ustutifa', 'Owner', 1, 1, NULL, 1789610400000);

INSERT INTO staff_branches(staff_email, branch_id)
VALUES
  ('tiftazani.khara@gmail.com', 'debug-bunayya'),
  ('us.archuleta1207@gmail.com', 'debug-bunayya');

INSERT INTO sync_changes(organization_id, entity_type, entity_id, operation, payload_json, updated_at, branch_id, actor_email, command_id)
VALUES
  ('cuciin', 'branch', 'debug-bunayya', 'upsert', '{"id":"debug-bunayya","code":"DEBUG","name":"Cabang Debug","location":"Data uji lokal","mapsQuery":""}', 1789610400000, 'debug-bunayya', 'system', 'debug-seed-branch-v1'),
  ('cuciin', 'staff', 'tiftazani.khara@gmail.com', 'upsert', '{"name":"Cuciin","email":"tiftazani.khara@gmail.com","role":"Owner","branchIds":["debug-bunayya"],"approved":true,"active":true}', 1789610400000, 'debug-bunayya', 'system', 'debug-seed-owner-1-v1'),
  ('cuciin', 'staff', 'us.archuleta1207@gmail.com', 'upsert', '{"name":"Ustutifa","email":"us.archuleta1207@gmail.com","role":"Owner","branchIds":["debug-bunayya"],"approved":true,"active":true}', 1789610400000, 'debug-bunayya', 'system', 'debug-seed-owner-2-v1');
