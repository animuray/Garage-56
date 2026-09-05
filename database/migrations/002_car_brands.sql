-- Migration 002: Car brands table
CREATE TABLE IF NOT EXISTS car_brands (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  image_url   TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO car_brands (name, sort_order) VALUES
  ('BMW',          1),
  ('BYD',          2),
  ('Changan',      3),
  ('Chery',        4),
  ('Chevrolet',    5),
  ('Haval',        6),
  ('Hyundai',      7),
  ('Kia',          8),
  ('Lada',         9),
  ('Lexus',        10),
  ('Li Auto',      11),
  ('Mazda',        12),
  ('Mercedes-Benz',13),
  ('Mitsubishi',   14),
  ('Nissan',       15),
  ('Skoda',        16),
  ('Tank',         17),
  ('Tesla',        18),
  ('Toyota',       19),
  ('Volvo',        20)
ON CONFLICT (name) DO NOTHING;
