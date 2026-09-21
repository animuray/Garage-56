-- 009_appointment_source.sql
-- "New bookings" notification in the CRM: remember where a booking came from (public site / Telegram bot)
-- and, per employee, the last booking id they have already seen.
-- NOTE: keep this file free of characters outside WIN1251 (the production DB encoding).

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source VARCHAR(10);      -- 'site' | 'telegram'; NULL = created in the CRM / unknown

-- bookings made from the bot before this column existed carry a marker in the comment
UPDATE appointments
   SET source = 'telegram'
 WHERE source IS NULL AND comment LIKE 'Запись из Telegram%';

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS appointments_seen_id INT;

-- everything older than an hour counts as already seen; the last hour still shows up as new
UPDATE employees
   SET appointments_seen_id = (SELECT COALESCE(MAX(id), 0) FROM appointments WHERE created_at < NOW() - INTERVAL '1 hour')
 WHERE appointments_seen_id IS NULL;
