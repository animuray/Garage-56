-- 004_telegram_bot.sql
-- Telegram bot for corporate clients: one-time connect codes + linked Telegram users.
-- The bot has NO own car/appointment storage — it works on the same tables as the CRM.

ALTER TABLE corporate_clients
  ADD COLUMN IF NOT EXISTS connect_code            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS connect_code_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_corporate_connect_code
  ON corporate_clients(connect_code)
  WHERE connect_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS telegram_users (
  id           SERIAL PRIMARY KEY,
  telegram_id  BIGINT       NOT NULL UNIQUE,
  corporate_id INT          NOT NULL REFERENCES corporate_clients(id) ON DELETE CASCADE,
  name         VARCHAR(150),
  username     VARCHAR(64),
  role         VARCHAR(20)  NOT NULL DEFAULT 'owner',  -- reserved for roles (owner/mechanic/accountant)
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_corp ON telegram_users(corporate_id);

-- 24h reminder is sent once per appointment
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS tg_reminded BOOLEAN NOT NULL DEFAULT false;

-- Report queries filter completed appointments by organisation and period
CREATE INDEX IF NOT EXISTS idx_appointments_corp_date ON appointments(corporate_id, date);
