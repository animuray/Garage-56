-- 007_car_archive.sql
-- Cars are never physically deleted: "delete" = archive. The car row, its service history and its
-- orders stay in the database forever, so reports and spending totals never shrink.
-- An archived car keeps its license plate reserved (the plate can not be added again - it is restored instead).
-- NOTE: keep this file free of characters outside WIN1251 (the production DB encoding).

ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by INT REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cars_archived ON cars(archived_at) WHERE archived_at IS NOT NULL;

-- Safety net: a car that has service history can no longer be hard-deleted by accident
-- (before, deleting the car silently wiped its history through ON DELETE CASCADE).
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'service_history'::regclass AND contype = 'f' AND confrelid = 'cars'::regclass
  LOOP
    EXECUTE format('ALTER TABLE service_history DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE service_history
    ADD CONSTRAINT service_history_car_id_fkey FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE RESTRICT;
END $$;
