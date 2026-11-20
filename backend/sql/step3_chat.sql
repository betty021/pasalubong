-- Hakbang 3: Chat (customer <-> may-ari). Ligtas patakbuhin ulit.
-- Isang usapan bawat customer (UNIQUE customer_id). Ang may-ari ay "admin".
CREATE TABLE IF NOT EXISTS conversations (
  id               BIGSERIAL PRIMARY KEY,
  customer_id      BIGINT NOT NULL UNIQUE REFERENCES customers(id),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_last_idx ON conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id               BIGSERIAL PRIMARY KEY,
  conversation_id  BIGINT NOT NULL REFERENCES conversations(id),
  sender_role      VARCHAR(10) NOT NULL CHECK (sender_role IN ('customer','admin')),
  body             VARCHAR(2000) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_conv_idx   ON messages (conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (conversation_id, sender_role) WHERE read_at IS NULL;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
