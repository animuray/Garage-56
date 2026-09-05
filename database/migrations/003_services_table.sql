CREATE TABLE IF NOT EXISTS services (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  description TEXT,
  price       DECIMAL(12,2) NOT NULL DEFAULT 0,
  duration    INT           NOT NULL DEFAULT 30,
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  sort_order  INT           NOT NULL DEFAULT 0,
  image_url   VARCHAR(255)
);
