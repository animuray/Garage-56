-- 010_service_materials.sql
-- Completing an order now picks materials from the warehouse for whatever the job actually needed
-- (any category, any quantity) instead of a fixed "oil + 3 filters" template that was always required.
-- Stored as JSON since the list is free-form; oil and the 3 filter slots keep their own columns
-- (used by the corporate reports and analytics), everything else (antifreeze, freon, brake fluid,
-- other) goes into used_items.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS used_items     JSONB,
  ADD COLUMN IF NOT EXISTS service_prices JSONB;

ALTER TABLE service_history
  ADD COLUMN IF NOT EXISTS used_items     JSONB,
  ADD COLUMN IF NOT EXISTS service_prices JSONB;

-- oil_viscosity stores the warehouse item's full name (e.g. "Shell Helix HX8 5W-30"), not just the
-- grade, and 20 characters was already too narrow for several real product names.
ALTER TABLE appointments      ALTER COLUMN oil_viscosity TYPE VARCHAR(100);
ALTER TABLE service_history   ALTER COLUMN oil_viscosity TYPE VARCHAR(100);
