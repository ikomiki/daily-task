-- M2 マイグレーション 10: Realtime publication
-- legend-state の syncedSupabase からリアルタイム購読するテーブルを登録。
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.4

-- supabase_realtime publication は Supabase が自動作成済み。
-- 既に登録されているテーブルがあればエラーになるため、明示的に追加する。

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.time_slots;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_stash;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
