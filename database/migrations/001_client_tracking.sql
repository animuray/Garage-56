-- 001_client_tracking.sql
-- Adds client tracking: auto-link appointments to clients/cars, track visit stats

-- Extend clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_regular       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_visit_at   DATE,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_phone_norm
  ON clients(phone_normalized)
  WHERE phone_normalized IS NOT NULL;

-- Extend appointments with FK links to clients/cars
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS car_id    INT REFERENCES cars(id)    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_car    ON appointments(car_id);

-- Extend cars with normalized plate for deduplication
ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS plate_normalized VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_plate_norm
  ON cars(plate_normalized)
  WHERE plate_normalized IS NOT NULL;

-- Default: 3 completed visits = regular client
INSERT INTO settings (key, value)
  VALUES ('regular_client_threshold', '3')
  ON CONFLICT (key) DO NOTHING;
