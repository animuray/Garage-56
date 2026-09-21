-- 006_car_delete_requests.sql
-- A corporate client can not delete cars itself: it sends a request (from the Telegram bot),
-- the Garage 56 administrator approves (the car is deleted) or rejects it in the CRM.
-- NOTE: keep this file free of characters outside WIN1251 (the production DB encoding).

CREATE TABLE IF NOT EXISTS car_delete_requests (
  id            SERIAL PRIMARY KEY,
  corporate_id  INT          NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  car_id        INT          REFERENCES cars(id) ON DELETE SET NULL,   -- becomes NULL once the car is deleted
  car_label     VARCHAR(150) NOT NULL,                                 -- snapshot: make + model
  license_plate VARCHAR(20)  NOT NULL,                                 -- snapshot
  reason        TEXT,
  requested_by  VARCHAR(150),
  telegram_id   BIGINT,
  status        VARCHAR(12)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  admin_comment TEXT,
  resolved_by   INT          REFERENCES employees(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- one open request per car
CREATE UNIQUE INDEX IF NOT EXISTS idx_car_delete_one_pending
  ON car_delete_requests(car_id)
  WHERE status = 'pending' AND car_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_car_delete_status ON car_delete_requests(status, corporate_id);
