-- 011_appointment_cancel_requests.sql
-- A corporate client can not cancel a CONFIRMED (or in-work) appointment itself: it sends a request
-- (from the Telegram bot, with a mandatory reason), the Garage 56 administrator approves (the
-- appointment is cancelled) or rejects it in the CRM. A still-pending appointment can still be
-- cancelled directly by the client -- this table is only for the "already confirmed" stage.
-- NOTE: keep this file free of characters outside WIN1251 (the production DB encoding).

CREATE TABLE IF NOT EXISTS appointment_cancel_requests (
  id             SERIAL PRIMARY KEY,
  appointment_id INT          NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  corporate_id   INT          NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  car_label      VARCHAR(150) NOT NULL,                 -- snapshot: make + model
  license_plate  VARCHAR(20)  NOT NULL,                 -- snapshot
  appt_date      DATE         NOT NULL,                 -- snapshot of the appointment at request time
  appt_time      TIME         NOT NULL,
  reason         TEXT         NOT NULL,                 -- mandatory: the client must explain why
  requested_by   VARCHAR(150),
  telegram_id    BIGINT,
  status         VARCHAR(12)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  admin_comment  TEXT,
  resolved_by    INT          REFERENCES employees(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);

-- one open request per appointment
CREATE UNIQUE INDEX IF NOT EXISTS idx_apt_cancel_one_pending
  ON appointment_cancel_requests(appointment_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_apt_cancel_status ON appointment_cancel_requests(status, corporate_id);
