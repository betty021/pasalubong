-- Idagdag ang mga column para sa delivery (munisipyo, barangay, street, map pin).
-- Ligtas ulitin. I-paste sa Supabase -> SQL Editor -> Run.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_province     VARCHAR(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_municipality VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_barangay     VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_street       VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat          NUMERIC(9,6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng          NUMERIC(9,6);

-- Pangsuri: dapat 6 na row ang lalabas
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'orders' AND column_name LIKE 'delivery\_%' ORDER BY column_name;
