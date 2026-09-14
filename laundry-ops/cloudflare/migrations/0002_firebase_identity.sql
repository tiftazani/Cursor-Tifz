ALTER TABLE staff ADD COLUMN firebase_uid TEXT;
CREATE UNIQUE INDEX idx_staff_firebase_uid ON staff(firebase_uid) WHERE firebase_uid IS NOT NULL;
