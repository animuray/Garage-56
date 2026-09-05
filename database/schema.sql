-- Garage 56 — PostgreSQL Schema

CREATE TABLE IF NOT EXISTS employees (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(100) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(20)  NOT NULL DEFAULT 'master'
                  CHECK (role IN ('owner','admin','master','corporate')),
  phone           VARCHAR(20),
  specialization  VARCHAR(100),
  corporate_id    INT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  email       VARCHAR(100),
  visit_count INT          NOT NULL DEFAULT 0,
  last_visit  DATE,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at  DATE         NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS corporate_clients (
  id              SERIAL PRIMARY KEY,
  company_name    VARCHAR(100) NOT NULL,
  contact_person  VARCHAR(100) NOT NULL,
  phone           VARCHAR(20)  NOT NULL,
  email           VARCHAR(100),
  contract        VARCHAR(100),
  comment         TEXT
);

ALTER TABLE employees
  ADD CONSTRAINT fk_emp_corp
  FOREIGN KEY (corporate_id) REFERENCES corporate_clients(id) ON DELETE SET NULL
  NOT VALID;

CREATE TABLE IF NOT EXISTS cars (
  id              SERIAL PRIMARY KEY,
  client_id       INT REFERENCES clients(id) ON DELETE SET NULL,
  corporate_id    INT REFERENCES corporate_clients(id) ON DELETE SET NULL,
  make            VARCHAR(50)  NOT NULL,
  model           VARCHAR(50)  NOT NULL,
  year            INT          NOT NULL,
  engine_type     VARCHAR(20)  NOT NULL,
  engine_volume   DECIMAL(3,1) NOT NULL,
  license_plate   VARCHAR(20)  NOT NULL UNIQUE,
  vin             VARCHAR(20),
  mileage         INT          NOT NULL DEFAULT 0,
  last_service    DATE,
  next_service    DATE
);

CREATE TABLE IF NOT EXISTS service_history (
  id           SERIAL PRIMARY KEY,
  car_id       INT REFERENCES cars(id) ON DELETE CASCADE,
  date         DATE    NOT NULL,
  mileage      INT     NOT NULL,
  services     TEXT[]  NOT NULL DEFAULT '{}',
  oil_brand    VARCHAR(50),
  oil_viscosity VARCHAR(20),
  oil_liters   DECIMAL(4,1),
  oil_filter   VARCHAR(50),
  air_filter   VARCHAR(50),
  cabin_filter VARCHAR(50),
  fuel_filter  VARCHAR(50),
  antifreeze   VARCHAR(50),
  freon        VARCHAR(50),
  master_notes TEXT,
  total        DECIMAL(12,2) NOT NULL DEFAULT 0,
  master_name  VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS appointments (
  id              SERIAL PRIMARY KEY,
  date            DATE    NOT NULL,
  time            TIME    NOT NULL,
  client_name     VARCHAR(100) NOT NULL,
  client_phone    VARCHAR(20)  NOT NULL,
  car_make        VARCHAR(50)  NOT NULL,
  car_model       VARCHAR(50)  NOT NULL,
  car_year        INT          NOT NULL,
  license_plate   VARCHAR(20)  NOT NULL,
  engine_type     VARCHAR(50),
  engine_volume   DECIMAL(3,1),
  mileage         INT,
  vin             VARCHAR(20),
  services        TEXT[]       NOT NULL DEFAULT '{}',
  oil_preference  VARCHAR(100),
  comment         TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  master_id       INT REFERENCES employees(id) ON DELETE SET NULL,
  corporate_id    INT REFERENCES corporate_clients(id) ON DELETE SET NULL,
  total           DECIMAL(12,2),
  cancel_reason   TEXT,
  oil_brand       VARCHAR(50),
  oil_viscosity   VARCHAR(20),
  oil_liters      DECIMAL(4,1),
  oil_filter      VARCHAR(50),
  air_filter      VARCHAR(50),
  cabin_filter    VARCHAR(50),
  service_notes   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  category     VARCHAR(30)  NOT NULL
               CHECK (category IN ('oil','filter','antifreeze','freon','brake_fluid','other')),
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit         VARCHAR(10)  NOT NULL,
  min_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  price        DECIMAL(12,2) NOT NULL DEFAULT 0,
  brand        VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT        NOT NULL
);
