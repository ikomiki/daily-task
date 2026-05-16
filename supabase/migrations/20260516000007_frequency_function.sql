-- M2 マイグレーション 7: 頻度判定関数
-- TypeScript 側の habit-core/src/frequency.ts と同等の判定ロジック。
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.2

CREATE OR REPLACE FUNCTION public.is_due_on(
  rule jsonb,
  target_date date,
  anchor_date date
)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  rule_type text := rule->>'type';
  rule_n int;
  rule_anchor date;
  rule_day_of_week int;
  target_dow int;
  nth_weekday int;
  first_match_date date;
BEGIN
  -- 共通: タスク作成前の日付は常に false
  IF target_date < anchor_date THEN
    RETURN false;
  END IF;

  target_dow := EXTRACT(ISODOW FROM target_date)::int;

  IF rule_type = 'daily' THEN
    RETURN true;

  ELSIF rule_type = 'every_n_days' THEN
    rule_n := (rule->>'n')::int;
    rule_anchor := (rule->>'anchor')::date;
    IF target_date < rule_anchor THEN
      RETURN false;
    END IF;
    RETURN ((target_date - rule_anchor) % rule_n) = 0;

  ELSIF rule_type = 'weekday' THEN
    RETURN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(rule->'days') AS d(v)
      WHERE d.v::int = target_dow
    );

  ELSIF rule_type = 'day_of_week' THEN
    -- まず曜日マッチを確認
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(rule->'days') AS d(v)
      WHERE d.v::int = target_dow
    ) THEN
      RETURN false;
    END IF;

    -- weeks_of_month 指定がなければ毎週マッチ
    IF (rule->'weeks_of_month') IS NULL OR (rule->'weeks_of_month') = 'null'::jsonb THEN
      RETURN true;
    END IF;

    -- 第 n 週判定: その月の同曜日の何回目か
    nth_weekday := (EXTRACT(DAY FROM target_date)::int - 1) / 7 + 1;
    RETURN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(rule->'weeks_of_month') AS w(v)
      WHERE w.v::int = nth_weekday
    );

  ELSIF rule_type = 'every_n_weeks' THEN
    rule_n := (rule->>'n')::int;
    rule_anchor := (rule->>'anchor')::date;
    rule_day_of_week := (rule->>'day_of_week')::int;

    -- 曜日が一致しなければ false
    IF target_dow != rule_day_of_week THEN
      RETURN false;
    END IF;

    -- anchor 以降で初めて day_of_week にマッチする日付
    first_match_date := rule_anchor
      + ((rule_day_of_week - EXTRACT(ISODOW FROM rule_anchor)::int + 7) % 7);

    IF target_date < first_match_date THEN
      RETURN false;
    END IF;

    RETURN ((target_date - first_match_date) % (rule_n * 7)) = 0;

  ELSE
    -- 未知の type は false
    RETURN false;
  END IF;
END;
$$;

-- task_days = (created_at から CURRENT_DATE までで is_due_on が真の日数) - skip_count
-- task_stash_view から使う
CREATE OR REPLACE FUNCTION public.compute_task_days(
  t_frequency jsonb,
  t_created_at date,
  t_skip_count int
)
RETURNS int
LANGUAGE sql STABLE
AS $$
  SELECT GREATEST(0,
    (SELECT COUNT(*)::int
     FROM generate_series(t_created_at, CURRENT_DATE, INTERVAL '1 day') AS d
     WHERE public.is_due_on(t_frequency, d::date, t_created_at)
    ) - t_skip_count
  );
$$;
