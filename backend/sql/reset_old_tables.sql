-- Patakbuhin MUNA ito sa Supabase SQL Editor (isang beses lang).
-- Binubura nito ang lumang shops/shop_owners at ang lumang categories/products (wala pang laman).
-- HINDI ginagalaw ang admins at customers.
DROP TABLE IF EXISTS products     CASCADE;
DROP TABLE IF EXISTS categories   CASCADE;
DROP TABLE IF EXISTS shop_owners  CASCADE;
DROP TABLE IF EXISTS shops        CASCADE;
