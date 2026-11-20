-- LAHAT ng bagong pagbabago sa database sa isang paste. Ligtas ulitin.
-- I-paste sa Supabase -> SQL Editor -> Run (isang beses).

-- 1) Lokasyon ng tindahan (map pin para sa Pickup)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6);
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

-- 2) Shipping fee (Delivery)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);
ALTER TABLE orders         ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);

-- 3) Status na "out_for_delivery"
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c); END LOOP;
END $$;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','preparing','ready','out_for_delivery','completed','cancelled'));

-- 4) client_key (iwas-doble sa offline order)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_key_uq ON orders (customer_id, client_key) WHERE client_key IS NOT NULL;

-- Pangsuri: dapat 5 na row ang lalabas
SELECT table_name, column_name FROM information_schema.columns
 WHERE (table_name = 'store_settings' AND column_name IN ('lat','lng','shipping_fee'))
    OR (table_name = 'orders' AND column_name IN ('shipping_fee','client_key'))
 ORDER BY table_name, column_name;
