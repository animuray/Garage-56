-- 005_oil_cost.sql
-- The final price of a completed order is: services + oil (liters * price per liter from the warehouse).
-- Keep the oil part separately so it can be shown in order details, the service book and reports.
-- NOTE: keep this file free of characters outside WIN1251 (the production DB encoding).

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS oil_price DECIMAL(12,2),   -- price per liter at the moment of completion
  ADD COLUMN IF NOT EXISTS oil_cost  DECIMAL(12,2);   -- liters * price per liter

ALTER TABLE service_history
  ADD COLUMN IF NOT EXISTS oil_price DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS oil_cost  DECIMAL(12,2);
