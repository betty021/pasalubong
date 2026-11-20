-- Hakbang 7: Profile picture (customer at may-ari). Ligtas patakbuhin ulit.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE admins    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
