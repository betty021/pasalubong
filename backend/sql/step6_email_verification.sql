-- ---------- Hakbang 6: Email verification ng customer ----------
-- Ang mga customer na MAYROON NA bago ito ay awtomatikong "verified" (ISANG BESES lang ito mangyayari,
-- kapag unang nadagdag ang column). Ang mga bagong mag-sign up ay kailangang mag-verify.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'customers' AND column_name = 'email_verified_at') THEN
    ALTER TABLE customers ADD COLUMN email_verified_at TIMESTAMPTZ;
    UPDATE customers SET email_verified_at = now();
  END IF;
END $$;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verify_code_hash  VARCHAR(64);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verify_expires_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verify_attempts   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS verify_sent_at    TIMESTAMPTZ;
