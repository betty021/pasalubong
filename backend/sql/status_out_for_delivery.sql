-- Dagdag na status na "out_for_delivery" (idedeliver na) para sa Delivery orders.
-- Ligtas ulitin. I-paste sa Supabase -> SQL Editor -> Run.
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c); END LOOP;
END $$;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','preparing','ready','out_for_delivery','completed','cancelled'));
