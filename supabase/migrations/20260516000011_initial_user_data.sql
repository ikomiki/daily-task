-- M2 マイグレーション 11: 新規ユーザー作成時の初期データ自動生成
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.5

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  morning_slot_id uuid;
  evening_slot_id uuid;
  anchor_str text := to_char(NEW.created_at::date, 'YYYY-MM-DD');
BEGIN
  -- profiles
  INSERT INTO public.profiles (id) VALUES (NEW.id);

  -- 朝スロット (07:00)
  INSERT INTO public.time_slots (user_id, name, notify_at, sort_order)
  VALUES (NEW.id, '朝', '07:00', 0)
  RETURNING id INTO morning_slot_id;

  -- 夜スロット (21:00, 仕様未指定のため合理的デフォルト)
  INSERT INTO public.time_slots (user_id, name, notify_at, sort_order)
  VALUES (NEW.id, '夜', '21:00', 1)
  RETURNING id INTO evening_slot_id;

  -- 朝の初期タスク 4 件
  INSERT INTO public.tasks (user_id, time_slot_id, name, frequency, sort_order)
  VALUES
    (NEW.id, morning_slot_id, '歯を磨く',
     '{"type":"daily"}'::jsonb, 0),
    (NEW.id, morning_slot_id, 'メールを確認する',
     '{"type":"weekday","days":[1,2,3,4,5]}'::jsonb, 1),
    (NEW.id, morning_slot_id, '今日のタスクを見直す',
     '{"type":"weekday","days":[1,2,3,4,5]}'::jsonb, 2),
    (NEW.id, morning_slot_id, '不燃物のゴミ捨て',
     '{"type":"day_of_week","days":[4],"weeks_of_month":[2,4]}'::jsonb, 3);

  -- 夜の初期タスク 2 件
  INSERT INTO public.tasks (user_id, time_slot_id, name, frequency, sort_order)
  VALUES
    (NEW.id, evening_slot_id, '運動する',
     jsonb_build_object('type', 'every_n_days', 'n', 3, 'anchor', anchor_str), 0),
    (NEW.id, evening_slot_id, '掃除する',
     jsonb_build_object('type', 'every_n_weeks', 'n', 2, 'day_of_week', 6, 'anchor', anchor_str), 1);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
