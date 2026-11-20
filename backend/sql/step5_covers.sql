-- Hakbang 5: hanggang 3 cover photo. Ligtas patakbuhin ulit.
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cover2_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cover3_url TEXT;
