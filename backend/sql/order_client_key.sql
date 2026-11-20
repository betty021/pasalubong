-- Unique key bawat order mula sa browser (client_key) para hindi magdoble ang order
-- kapag inulit ang pagpapadala (hal. offline order na na-sync). Ligtas ulitin.
-- I-paste sa Supabase -> SQL Editor -> Run.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_key_uq ON orders (customer_id, client_key) WHERE client_key IS NOT NULL;

-- Pangsuri: dapat 1 na row ang lalabas
SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'client_key';
