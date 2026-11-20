-- Lokasyon ng tindahan (map pin) para alam ng customer kung saan magpa-pickup.
-- Ligtas ulitin. I-paste sa Supabase -> SQL Editor -> Run.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6);
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

-- Pangsuri: dapat 2 na row ang lalabas
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'store_settings' AND column_name IN ('lat', 'lng') ORDER BY column_name;
