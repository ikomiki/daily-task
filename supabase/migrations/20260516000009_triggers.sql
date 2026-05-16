-- M2 マイグレーション 9: task_logs → task_stash 反映トリガー
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.3

CREATE OR REPLACE FUNCTION public.update_task_stash()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_task_id uuid := COALESCE(NEW.task_id, OLD.task_id);
  new_complete_count int;
  new_fail_count int;
  new_skip_count int;
  new_current_streak int := 0;
  new_last_completed_date date;
  log_row RECORD;
BEGIN
  -- カウント集計
  SELECT
    COUNT(*) FILTER (WHERE status = 'complete'),
    COUNT(*) FILTER (WHERE status = 'fail'),
    COUNT(*) FILTER (WHERE status = 'skip'),
    MAX(date) FILTER (WHERE status = 'complete')
  INTO new_complete_count, new_fail_count, new_skip_count, new_last_completed_date
  FROM public.task_logs
  WHERE task_id = target_task_id;

  -- streak 計算: 最新日付から走査
  --   complete -> +1
  --   skip     -> 継続（streak は変化しない）
  --   fail     -> ここで打ち切り
  FOR log_row IN
    SELECT status FROM public.task_logs
    WHERE task_id = target_task_id
    ORDER BY date DESC
  LOOP
    IF log_row.status = 'complete' THEN
      new_current_streak := new_current_streak + 1;
    ELSIF log_row.status = 'skip' THEN
      CONTINUE;
    ELSIF log_row.status = 'fail' THEN
      EXIT;
    END IF;
  END LOOP;

  -- task_stash 更新（task_stash 行は tasks INSERT トリガーで予め作成済み）
  UPDATE public.task_stash SET
    complete_count = new_complete_count,
    fail_count = new_fail_count,
    skip_count = new_skip_count,
    current_streak = new_current_streak,
    last_completed_date = new_last_completed_date,
    updated_at = now()
  WHERE task_id = target_task_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER task_logs_update_stash
  AFTER INSERT OR UPDATE OR DELETE ON public.task_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_task_stash();
