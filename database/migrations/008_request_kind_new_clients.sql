-- 008_request_kind_new_clients.sql
-- 1) A corporate client can also ask to RESTORE an archived car (goes to the CRM like a delete request).
-- 2) "New clients" badge in the CRM: remember, per employee, the last client id they have seen.
-- NOTE: keep this file free of characters outside WIN1251 (the production DB encoding).

ALTER TABLE car_delete_requests
  ADD COLUMN IF NOT EXISTS kind VARCHAR(10) NOT NULL DEFAULT 'delete';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'car_requests_kind_check') THEN
    ALTER TABLE car_delete_requests
      ADD CONSTRAINT car_requests_kind_check CHECK (kind IN ('delete','restore'));
  END IF;
END $$;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS clients_seen_id INT;

-- existing clients are not "new": start every employee from the current last client
UPDATE employees
   SET clients_seen_id = (SELECT COALESCE(MAX(id), 0) FROM clients)
 WHERE clients_seen_id IS NULL;
