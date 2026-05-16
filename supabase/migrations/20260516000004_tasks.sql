-- M2 マイグレーション 4: tasks テーブル
-- ユーザーごとのタスクテンプレート。frequency は jsonb で頻度ルールを保持。
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.2

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_slot_id uuid NOT NULL REFERENCES public.time_slots(id) ON DELETE RESTRICT,
  name text NOT NULL,
  frequency jsonb NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 頻度ルールの type 値を制約
  CONSTRAINT tasks_frequency_type_check CHECK (
    frequency->>'type' IN (
      'daily', 'every_n_days', 'weekday', 'day_of_week', 'every_n_weeks'
    )
  )
);

CREATE INDEX tasks_user_id_idx ON public.tasks(user_id, archived_at);
CREATE INDEX tasks_time_slot_id_idx ON public.tasks(time_slot_id);

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own" ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
