-- Penugasan akses menjadi kanonik; role hilang tetap disimpan agar gagal tertutup.
ALTER TABLE staff ADD COLUMN access_role_id TEXT NOT NULL DEFAULT '';

-- Hanya jurnal staff terbaru yang sah. Jangan hidupkan penugasan sebelum delete,
-- atau ambil penugasan lama bila kiriman terakhir telah mengosongkannya.
UPDATE staff SET access_role_id = COALESCE((
  SELECT CASE WHEN operation='upsert' AND json_valid(payload_json) THEN CASE WHEN
    (command_id IS NULL OR EXISTS (
      SELECT 1 FROM processed_commands pc
      WHERE pc.command_id=sync_changes.command_id
        AND pc.organization_id=staff.organization_id AND pc.command_type='staff.upsert'
    ))
    AND lower(json_extract(payload_json,'$.email'))=lower(staff.email)
    AND json_type(payload_json,'$.accessRoleId')='text'
    THEN trim(json_extract(payload_json,'$.accessRoleId')) ELSE '' END ELSE '' END
  FROM sync_changes
  WHERE organization_id=staff.organization_id AND entity_type='staff'
    AND lower(entity_id)=lower(staff.email)
  ORDER BY sequence DESC LIMIT 1
), '');
