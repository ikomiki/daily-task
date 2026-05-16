-- M2 マイグレーション 6: task_stash テーブル
-- task_logs のイベントで自動更新される集計テーブル。
-- ユーザーは SELECT のみ可。書き込みはトリガー（SECURITY DEFINER）が担当。

CREATE TABLE public.task_stash (
  task_id uuid PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  complete_count int NOT NULL DEFAULT 0,
  fail_count int NOT NULL DEFAULT 0,
  skip_count int NOT NULL DEFAULT 0,
  current_streak int NOT NULL DEFAULT 0,
  last_completed_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS（task_id 経由で user_id にたどる、SELECT のみ）
ALTER TABLE public.task_stash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_stash_select_own" ON public.task_stash
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_stash.task_id AND t.user_id = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE のポリシーは作らない（トリガー以外からは触れない）

-- tasks INSERT 時に task_stash 行を自動作成
CREATE OR REPLACE FUNCTION public.init_task_stash()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.task_stash (task_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_init_stash
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.init_task_stash();
