-- M2 マイグレーション 5: task_logs テーブル
-- 各タスクの日別状態記録。1 タスク 1 日 1 行の boolean 状態。
-- 'empty' は行の不在で表現するため、status enum には含めない。

CREATE TYPE public.task_status AS ENUM ('complete', 'skip', 'fail');

CREATE TABLE public.task_logs (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  date date NOT NULL,
  status public.task_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, date)
);

-- streak 計算用: 同一 task_id を日付降順で走査する
CREATE INDEX task_logs_task_date_desc_idx
  ON public.task_logs(task_id, date DESC);

-- 直近 N 日の購読用: 全タスク横断で日付ベースに引く
CREATE INDEX task_logs_date_idx ON public.task_logs(date);

-- RLS（task_id 経由で user_id にたどる）
ALTER TABLE public.task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_logs_select_own" ON public.task_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "task_logs_insert_own" ON public.task_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "task_logs_update_own" ON public.task_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "task_logs_delete_own" ON public.task_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()
    )
  );

CREATE TRIGGER task_logs_set_updated_at
  BEFORE UPDATE ON public.task_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
