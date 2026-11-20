-- Pasalubong Hub - schema (PostgreSQL / Supabase)
-- Isang tindahan lang. Admin = may-ari. Customer = mamimili (walang approval).
-- Soft delete: may "deleted_at". NULL = buhay, may petsa = archived.
-- Ligtas patakbuhin ulit (IF NOT EXISTS).

-- Admin = may-ari ng tindahan
CREATE TABLE IF NOT EXISTS admins (
  id             BIGSERIAL PRIMARY KEY,
  email          VARCHAR(100) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Mga mamimili
CREATE TABLE IF NOT EXISTS customers (
  id             BIGSERIAL PRIMARY KEY,
  first_name     VARCHAR(60)  NOT NULL,
  last_name      VARCHAR(60)  NOT NULL,
  email          VARCHAR(100) NOT NULL,
  phone          VARCHAR(30),
  password_hash  VARCHAR(255) NOT NULL,
  status         VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_uq
  ON customers (lower(email)) WHERE deleted_at IS NULL;

-- Impormasyon ng tindahan (isang row lang, id = 1)
CREATE TABLE IF NOT EXISTS store_settings (
  id         INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name       VARCHAR(100) NOT NULL DEFAULT 'Pasalubong Hub',
  tagline    VARCHAR(120),
  about      VARCHAR(1000),
  address    VARCHAR(255),
  phone      VARCHAR(30),
  cover_url  TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO store_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Kategorya (hal. Food, Dried goods, Handicrafts)
CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(60) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_uq
  ON categories (lower(name)) WHERE deleted_at IS NULL;

-- Mga produkto (pasalubong)
CREATE TABLE IF NOT EXISTS products (
  id           BIGSERIAL PRIMARY KEY,
  category_id  BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  name         VARCHAR(100) NOT NULL,
  description  VARCHAR(1000),
  price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  unit         VARCHAR(30),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id) WHERE deleted_at IS NULL;

-- Mga order. Hindi binubura (kasaysayan). Ang pangalan at presyo ng produkto ay kinokopya sa order_items
-- para hindi magbago ang lumang order kapag in-edit o ina-archive ang produkto.
CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  code            VARCHAR(12)   NOT NULL UNIQUE,
  customer_id     BIGINT        NOT NULL REFERENCES customers(id),
  customer_name   VARCHAR(100)  NOT NULL,
  customer_phone  VARCHAR(30)   NOT NULL,
  fulfillment     VARCHAR(10)   NOT NULL DEFAULT 'pickup' CHECK (fulfillment IN ('pickup','delivery')),
  address         VARCHAR(255),
  notes           VARCHAR(1000),
  total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','preparing','ready','out_for_delivery','completed','cancelled')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_status_idx   ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    BIGINT        REFERENCES products(id),
  product_name  VARCHAR(100)  NOT NULL,
  quantity      INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- Awtomatikong update ng updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','categories','products','store_settings','orders'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- Seguridad: isara ang public Data API ng Supabase (ang backend ay direktang kumokonekta, hindi apektado)
ALTER TABLE admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items    ENABLE ROW LEVEL SECURITY;

-- ---------- Hakbang 2: Notification bell ----------
-- recipient_kind: customer (id ng customer) | admin (id 0 = ang may-ari)
CREATE TABLE IF NOT EXISTS notifications (
  id              BIGSERIAL PRIMARY KEY,
  recipient_kind  VARCHAR(10)  NOT NULL CHECK (recipient_kind IN ('customer','admin')),
  recipient_id    BIGINT       NOT NULL DEFAULT 0,
  type            VARCHAR(30)  NOT NULL,
  title           VARCHAR(120) NOT NULL,
  body            VARCHAR(300),
  link            VARCHAR(200),
  data            JSONB,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_rcpt_idx ON notifications (recipient_kind, recipient_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ---------- Hakbang 3: Delivery sa Mindoro (munisipyo, barangay, map pin) ----------
-- Ang "address" ay patuloy na naglalaman ng buong address bilang teksto; ang mga bagong column ay para sa hiwalay na datos at map pin.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_province     VARCHAR(40);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_municipality VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_barangay     VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_street       VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat          NUMERIC(9,6);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng          NUMERIC(9,6);

-- ---------- Hakbang 4: Lokasyon ng tindahan (para sa Pickup) ----------
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6);
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

-- ---------- Hakbang 5: Shipping fee (Delivery) ----------
-- orders.total = presyo ng mga item + shipping_fee. Kinokopya ang fee sa order para hindi magbago ang lumang order.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);
ALTER TABLE orders         ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0);

-- ---------- Hakbang 6: Status na "out_for_delivery" (para sa Delivery) ----------
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c); END LOOP;
END $$;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','preparing','ready','out_for_delivery','completed','cancelled'));

-- ---------- Hakbang 7: client_key (iwas-doble sa offline order) ----------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS orders_client_key_uq ON orders (customer_id, client_key) WHERE client_key IS NOT NULL;
