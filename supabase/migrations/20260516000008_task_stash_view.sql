-- M2 マイグレーション 8: task_stash_view
-- task_stash テーブルに task_days / completion_rate を補完した読み取り専用 VIEW。
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.3
-- security_invoker=true で利用者の RLS が適用される（task_stash / tasks のポリシーが効く）

CREATE OR REPLACE VIEW public.task_stash_view
WITH (security_invoker = true)
AS
SELECT
  ts.task_id,
  t.user_id,
  ts.complete_count,
  ts.fail_count,
  ts.skip_count,
  ts.current_streak,
  ts.last_completed_date,
  public.compute_task_days(t.frequency, t.created_at::date, ts.skip_count) AS task_days,
  CASE
    WHEN public.compute_task_days(t.frequency, t.created_at::date, ts.skip_count) > 0
    THEN ts.complete_count::numeric
         / public.compute_task_days(t.frequency, t.created_at::date, ts.skip_count)::numeric
    ELSE NULL
  END AS completion_rate,
  ts.updated_at
FROM public.task_stash ts
INNER JOIN public.tasks t ON t.id = ts.task_id;

-- VIEW へのアクセス許可（RLS は invoker の権限で評価される）
GRANT SELECT ON public.task_stash_view TO authenticated;
GRANT SELECT ON public.task_stash_view TO anon;
