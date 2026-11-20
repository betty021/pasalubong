-- ---------- Hakbang 8: Push notifications ----------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             SERIAL PRIMARY KEY,
  recipient_kind VARCHAR(10) NOT NULL,
  recipient_id   INTEGER     NOT NULL,
  endpoint       TEXT        NOT NULL UNIQUE,
  p256dh         TEXT        NOT NULL,
  auth           TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_rcpt_idx ON push_subscriptions (recipient_kind, recipient_id);
