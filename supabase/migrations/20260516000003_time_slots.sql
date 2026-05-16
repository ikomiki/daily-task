-- M2 マイグレーション 3: time_slots テーブル
-- ユーザーごとの時間帯（朝・夜など）と通知時刻

CREATE TABLE public.time_slots (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  notify_at time NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX time_slots_user_id_idx ON public.time_slots(user_id, sort_order);

-- RLS
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_slots_select_own" ON public.time_slots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "time_slots_insert_own" ON public.time_slots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_slots_update_own" ON public.time_slots
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_slots_delete_own" ON public.time_slots
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at 自動更新
CREATE TRIGGER time_slots_set_updated_at
  BEFORE UPDATE ON public.time_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
