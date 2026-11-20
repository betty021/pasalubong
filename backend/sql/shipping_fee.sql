-- Shipping fee para sa Delivery. Ligtas ulitin. I-paste sa Supabase -> SQL Editor -> Run.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);
ALTER TABLE orders         ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);

-- Pangsuri: dapat 2 na row ang lalabas
SELECT table_name, column_name FROM information_schema.columns
 WHERE column_name = 'shipping_fee' AND table_name IN ('store_settings', 'orders') ORDER BY table_name;
