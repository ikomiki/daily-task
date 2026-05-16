-- M2 マイグレーション 1: 拡張機能
-- pgcrypto: gen_random_uuid() を使うため
-- Supabase の最近のバージョンではデフォルトで有効だが明示的に保証する

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
