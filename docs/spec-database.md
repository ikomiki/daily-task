# Habits アプリ データベース仕様書

## 目次

1. [ER図](#1-er図)
2. [マイグレーション履歴](#2-マイグレーション履歴)
3. [テーブル定義](#3-テーブル定義)
4. [Enum・カスタム型定義](#4-enumカスタム型定義)
5. [VIEW 定義](#5-view-定義)
6. [RLS ポリシー](#6-rls-ポリシー)
7. [トリガーと関数](#7-トリガーと関数)
8. [インデックス一覧](#8-インデックス一覧)
9. [auth.users との連携](#9-authuserss-との連携)
10. [Realtime Publication](#10-realtime-publication)
11. [データフロー](#11-データフロー)
12. [アプリ型定義との対応](#12-アプリ型定義との対応)

---

## 1. ER図

```
auth.users (Supabase 管理)
    │
    ├─── profiles (1:1)
    │       id FK
    │
    ├─── time_slots (1:N)
    │       user_id FK
    │           │
    │           └─── tasks (1:N, RESTRICT)
    │                   user_id FK, time_slot_id FK
    │                       │
    │                       ├─── task_logs (1:N)
    │                       │       task_id FK, date → PK(task_id, date)
    │                       │
    │                       └─── task_stash (1:1)
    │                               task_id FK (PK)
    │
    └─── (VIEW) task_stash_view
            task_stash JOIN tasks（計算カラム補完）
```

**CASCADE 削除チェーン:**
```
auth.users 削除
    → profiles, time_slots, tasks が CASCADE 削除
        → task_logs, task_stash が CASCADE 削除
```

---

## 2. マイグレーション履歴

| # | ファイル名 | 内容 |
|---|-----------|------|
| 1 | `20260516000001_extensions.sql` | `pgcrypto` 拡張を有効化（`gen_random_uuid()` 使用のため） |
| 2 | `20260516000002_profiles.sql` | `profiles` テーブル作成・RLS・updated_at トリガー |
| 3 | `20260516000003_time_slots.sql` | `time_slots` テーブル作成・RLS・インデックス・updated_at トリガー |
| 4 | `20260516000004_tasks.sql` | `tasks` テーブル作成・frequency 型チェック制約・RLS・インデックス・updated_at トリガー |
| 5 | `20260516000005_task_logs.sql` | `task_status` ENUM 定義・`task_logs` テーブル作成・RLS・インデックス |
| 6 | `20260516000006_task_stash.sql` | `task_stash` テーブル作成・RLS（SELECT のみ）・`init_task_stash` トリガー登録 |
| 7 | `20260516000007_frequency_function.sql` | `is_due_on()` 関数・`compute_task_days()` 関数定義 |
| 8 | `20260516000008_task_stash_view.sql` | `task_stash_view` VIEW 作成・GRANT 設定 |
| 9 | `20260516000009_triggers.sql` | `update_task_stash()` 関数・`task_logs_update_stash` トリガー定義 |
| 10 | `20260516000010_realtime.sql` | 4テーブルを `supabase_realtime` publication に登録 |
| 11 | `20260516000011_initial_user_data.sql` | `handle_new_user()` 関数・`on_auth_user_created` トリガー定義 |

---

## 3. テーブル定義

### 3.1 `profiles` テーブル

ユーザープロフィール情報。現在は ID のみ管理（将来の SNS ログイン対応時に拡張予定）。

```sql
CREATE TABLE public.profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|-----|------|----------|------|
| `id` | `uuid` | NOT NULL | — | auth.users.id と同一（PK + FK） |
| `created_at` | `timestamptz` | NOT NULL | `now()` | レコード作成時刻 |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | レコード更新時刻（自動更新） |

**トリガー:** `profiles_set_updated_at` （BEFORE UPDATE）

---

### 3.2 `time_slots` テーブル

ユーザーが設定する時間帯（朝・夜など）と通知時刻。タスクはいずれかの時間帯に属する。

```sql
CREATE TABLE public.time_slots (
  id         uuid        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  notify_at  time        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|-----|------|----------|------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | 時間帯 ID（PK） |
| `user_id` | `uuid` | NOT NULL | — | 所有ユーザー（FK → auth.users） |
| `name` | `text` | NOT NULL | — | 表示名（「朝」「夜」など） |
| `notify_at` | `time` | NOT NULL | — | 通知時刻（HH:MM 形式） |
| `sort_order` | `int` | NOT NULL | `0` | 表示順序（昇順） |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 作成時刻 |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | 更新時刻（自動更新） |

**インデックス:** `time_slots_user_id_idx ON (user_id, sort_order)`

**トリガー:** `time_slots_set_updated_at` （BEFORE UPDATE）

**制約:** `tasks.time_slot_id` が RESTRICT FK を持つため、タスクが存在する時間帯は削除不可（DB レベル）

---

### 3.3 `tasks` テーブル

タスク定義。`frequency` JSONB カラムに頻度ルールを格納する。

```sql
CREATE TABLE public.tasks (
  id           uuid        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_slot_id uuid        NOT NULL REFERENCES public.time_slots(id) ON DELETE RESTRICT,
  name         text        NOT NULL,
  frequency    jsonb       NOT NULL,
  sort_order   int         NOT NULL DEFAULT 0,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_frequency_type_check CHECK (
    frequency->>'type' IN ('daily','every_n_days','weekday','day_of_week','every_n_weeks')
  )
);
```

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|-----|------|----------|------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | タスク ID（PK） |
| `user_id` | `uuid` | NOT NULL | — | 所有ユーザー（FK → auth.users） |
| `time_slot_id` | `uuid` | NOT NULL | — | 属する時間帯（FK → time_slots） |
| `name` | `text` | NOT NULL | — | タスク名 |
| `frequency` | `jsonb` | NOT NULL | — | 頻度ルール（§3.4 参照） |
| `sort_order` | `int` | NOT NULL | `0` | 表示順序（昇順） |
| `archived_at` | `timestamptz` | NULL | `NULL` | アーカイブ日時（NULL = 有効） |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 作成日時（頻度判定の anchor として使用） |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | 更新時刻（自動更新） |

**インデックス:**
- `tasks_user_id_idx ON (user_id, archived_at)`
- `tasks_time_slot_id_idx ON (time_slot_id)`

**トリガー:**
- `tasks_set_updated_at` （BEFORE UPDATE）
- `tasks_init_stash` （AFTER INSERT）→ task_stash 行を自動作成

#### 3.4 `frequency` JSONB スキーマ

```json
// 毎日
{ "type": "daily" }

// N日ごと（anchor 日から n 日おき）
{ "type": "every_n_days", "n": 3, "anchor": "2026-05-17" }

// 曜日指定（1=月, 2=火, ..., 7=日）
{ "type": "weekday", "days": [1, 2, 3, 4, 5] }

// 曜日 + 第N週（weeks_of_month 未指定 = 毎週）
{ "type": "day_of_week", "days": [4], "weeks_of_month": [2, 4] }

// N週ごと（anchor 日から n 週おきの day_of_week）
{ "type": "every_n_weeks", "n": 2, "day_of_week": 6, "anchor": "2026-05-17" }
```

---

### 3.5 `task_logs` テーブル

タスクの日別記録。1タスク1日1行。`status = 'empty'`（未操作）は行が存在しないことで表現する（疎な保存）。

```sql
CREATE TABLE public.task_logs (
  task_id    uuid              NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  date       date              NOT NULL,
  status     public.task_status NOT NULL,
  created_at timestamptz       NOT NULL DEFAULT now(),
  updated_at timestamptz       NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, date)
);
```

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|-----|------|----------|------|
| `task_id` | `uuid` | NOT NULL | — | タスク ID（PK の一部, FK → tasks） |
| `date` | `date` | NOT NULL | — | 記録日（PK の一部） |
| `status` | `task_status` | NOT NULL | — | 状態（complete / skip / fail） |
| `created_at` | `timestamptz` | NOT NULL | `now()` | 記録作成時刻 |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | 更新時刻（自動更新） |

**複合主キー:** `(task_id, date)`

**インデックス:**
- `task_logs_task_date_desc_idx ON (task_id, date DESC)` — streak 計算用（末尾から走査）
- `task_logs_date_idx ON (date)` — 日付範囲フィルタ用

**トリガー:**
- `task_logs_set_updated_at` （BEFORE UPDATE）
- `task_logs_update_stash` （AFTER INSERT OR UPDATE OR DELETE）→ task_stash を再集計

---

### 3.6 `task_stash` テーブル

タスクごとの集計情報。ユーザーは SELECT のみ可能。INSERT/UPDATE は SECURITY DEFINER トリガーのみが行う。

```sql
CREATE TABLE public.task_stash (
  task_id             uuid        PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  complete_count      int         NOT NULL DEFAULT 0,
  fail_count          int         NOT NULL DEFAULT 0,
  skip_count          int         NOT NULL DEFAULT 0,
  current_streak      int         NOT NULL DEFAULT 0,
  last_completed_date date,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

| カラム | 型 | NULL | デフォルト | 説明 |
|-------|-----|------|----------|------|
| `task_id` | `uuid` | NOT NULL | — | タスク ID（PK + FK → tasks） |
| `complete_count` | `int` | NOT NULL | `0` | 完了回数（トリガーによる自動集計） |
| `fail_count` | `int` | NOT NULL | `0` | 失敗回数（トリガーによる自動集計） |
| `skip_count` | `int` | NOT NULL | `0` | スキップ回数（トリガーによる自動集計） |
| `current_streak` | `int` | NOT NULL | `0` | 現在の連続完了数（fail でリセット、skip で維持） |
| `last_completed_date` | `date` | NULL | `NULL` | 最後に complete した日付 |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | 最終更新時刻 |

**RLS:** SELECT のみ許可（INSERT/UPDATE/DELETE ポリシーなし）

---

## 4. Enum・カスタム型定義

### `task_status`

```sql
CREATE TYPE public.task_status AS ENUM ('complete', 'skip', 'fail');
```

| 値 | 意味 | streak への影響 |
|----|------|---------------|
| `complete` | タスク完了 | +1 |
| `skip` | スキップ（意図的） | 維持（増えない） |
| `fail` | 失敗 | 0 にリセット |

**備考:** 未操作（empty）は `task_logs` に行が存在しないことで表現する。このため `'empty'` は ENUM に含まれない。

---

## 5. VIEW 定義

### `task_stash_view`

`task_stash` に計算カラム（`task_days` / `completion_rate` / `user_id`）を加えた読み取り専用 VIEW。

```sql
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
```

| カラム | 型 | 説明 |
|-------|-----|------|
| `task_id` | `uuid` | タスク ID |
| `user_id` | `uuid` | ユーザー ID（RLS フィルタに使用） |
| `complete_count` | `int` | 完了回数 |
| `fail_count` | `int` | 失敗回数 |
| `skip_count` | `int` | スキップ回数 |
| `current_streak` | `int` | 現在の連続完了数 |
| `last_completed_date` | `date` | 最後の完了日 |
| `task_days` | `int` | 対象日数（タスク作成日〜今日で頻度が合致する日数 − スキップ数） |
| `completion_rate` | `numeric` | 完了率（complete_count / task_days）。task_days = 0 の場合は NULL |
| `updated_at` | `timestamptz` | task_stash の最終更新時刻 |

**セキュリティ:** `security_invoker = true` により、VIEW にアクセスするユーザーの RLS（task_stash・tasks のポリシー）が適用される。

**権限:**
```sql
GRANT SELECT ON public.task_stash_view TO authenticated;
GRANT SELECT ON public.task_stash_view TO anon;
```

**Realtime 不可の理由:** VIEW は `supabase_realtime` publication に登録できないため postgres_changes イベントが発火しない。代わりに `task_stash` テーブルを購読して間接的に更新する（§10 参照）。

---

## 6. RLS ポリシー

全テーブルで Row Level Security (RLS) が有効。各ユーザーは `auth.uid() = user_id` で一致する自分のデータのみ操作できる。

### 6.1 `profiles`

```sql
-- SELECT: 自分のプロフィールのみ
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
-- INSERT: 自分の id でのみ挿入
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- UPDATE: 自分のプロフィールのみ更新
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- DELETE: 自分のプロフィールのみ削除
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);
```

---

### 6.2 `time_slots`

```sql
CREATE POLICY "time_slots_select_own" ON public.time_slots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_slots_insert_own" ON public.time_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_slots_update_own" ON public.time_slots FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_slots_delete_own" ON public.time_slots FOR DELETE USING (auth.uid() = user_id);
```

---

### 6.3 `tasks`

```sql
CREATE POLICY "tasks_select_own" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
```

---

### 6.4 `task_logs`

複合 PK（task_id, date）のため `user_id` カラムが存在しない。2段階の存在検証（task_id → tasks.user_id）を使用。

```sql
CREATE POLICY "task_logs_select_own" ON public.task_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid())
);
CREATE POLICY "task_logs_insert_own" ON public.task_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid())
);
CREATE POLICY "task_logs_update_own" ON public.task_logs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid()));
CREATE POLICY "task_logs_delete_own" ON public.task_logs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_logs.task_id AND t.user_id = auth.uid())
);
```

---

### 6.5 `task_stash`

`user_id` カラムなし。task_id を経由して検証。SELECT のみ許可（書き込みはトリガーのみ）。

```sql
CREATE POLICY "task_stash_select_own" ON public.task_stash FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_stash.task_id AND t.user_id = auth.uid())
);
```

---

## 7. トリガーと関数

### 7.1 `set_updated_at()` — updated_at 自動更新（汎用）

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
```

**登録先:**
- `profiles_set_updated_at` (BEFORE UPDATE ON profiles)
- `time_slots_set_updated_at` (BEFORE UPDATE ON time_slots)
- `tasks_set_updated_at` (BEFORE UPDATE ON tasks)
- `task_logs_set_updated_at` (BEFORE UPDATE ON task_logs)

---

### 7.2 `init_task_stash()` — タスク作成時の task_stash 行自動生成

```sql
CREATE OR REPLACE FUNCTION public.init_task_stash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.task_stash (task_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
```

**登録先:** `tasks_init_stash` (AFTER INSERT ON tasks)

**SECURITY DEFINER:** ユーザーは task_stash に INSERT できないため、スーパーユーザー権限で実行。

---

### 7.3 `is_due_on(rule, target_date, anchor_date)` — 頻度判定関数

```sql
CREATE OR REPLACE FUNCTION public.is_due_on(
  rule        jsonb,
  target_date date,
  anchor_date date
) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  rule_type      text := rule->>'type';
  rule_n         int;
  rule_anchor    date;
  rule_dow       int;
  target_dow     int;
  nth_weekday    int;
  first_match    date;
BEGIN
  -- タスク作成前は常に false
  IF target_date < anchor_date THEN RETURN false; END IF;

  target_dow := EXTRACT(ISODOW FROM target_date)::int;  -- 1=月...7=日

  IF rule_type = 'daily' THEN
    RETURN true;

  ELSIF rule_type = 'every_n_days' THEN
    rule_n      := (rule->>'n')::int;
    rule_anchor := (rule->>'anchor')::date;
    IF target_date < rule_anchor THEN RETURN false; END IF;
    RETURN ((target_date - rule_anchor) % rule_n) = 0;

  ELSIF rule_type = 'weekday' THEN
    RETURN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(rule->'days') d WHERE d::int = target_dow
    );

  ELSIF rule_type = 'day_of_week' THEN
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(rule->'days') d WHERE d::int = target_dow
    ) THEN RETURN false; END IF;
    IF (rule->'weeks_of_month') IS NULL OR (rule->'weeks_of_month') = 'null'::jsonb THEN
      RETURN true;
    END IF;
    nth_weekday := (EXTRACT(DAY FROM target_date)::int - 1) / 7 + 1;
    RETURN EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(rule->'weeks_of_month') w WHERE w::int = nth_weekday
    );

  ELSIF rule_type = 'every_n_weeks' THEN
    rule_n   := (rule->>'n')::int;
    rule_anchor := (rule->>'anchor')::date;
    rule_dow := (rule->>'day_of_week')::int;
    IF target_dow != rule_dow THEN RETURN false; END IF;
    first_match := rule_anchor
      + ((rule_dow - EXTRACT(ISODOW FROM rule_anchor)::int + 7) % 7);
    IF target_date < first_match THEN RETURN false; END IF;
    RETURN ((target_date - first_match) % (rule_n * 7)) = 0;

  ELSE
    RETURN false;
  END IF;
END;
$$;
```

**属性:** `IMMUTABLE`（同じ引数で常に同じ結果）

**用途:** `compute_task_days()` 内で日付範囲を iterate して呼ばれる。TypeScript 版（`habit-core/src/frequency.ts`）と同等のロジック。

---

### 7.4 `compute_task_days(t_frequency, t_created_at, t_skip_count)` — 対象日数計算

```sql
CREATE OR REPLACE FUNCTION public.compute_task_days(
  t_frequency  jsonb,
  t_created_at date,
  t_skip_count int
) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT GREATEST(0,
    (SELECT COUNT(*)::int
     FROM generate_series(t_created_at, CURRENT_DATE, INTERVAL '1 day') AS d
     WHERE public.is_due_on(t_frequency, d::date, t_created_at)
    ) - t_skip_count
  );
$$;
```

**計算式:** `max(0, タスク作成日〜今日の頻度一致日数 − スキップ数)`

**属性:** `STABLE`（同一トランザクション内では同じ結果）

**用途:** `task_stash_view` の `task_days` カラム・`completion_rate` カラムの計算に使用。

---

### 7.5 `update_task_stash()` — task_logs 変更後の集計更新

```sql
CREATE OR REPLACE FUNCTION public.update_task_stash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_task_id      uuid := COALESCE(NEW.task_id, OLD.task_id);
  new_complete_count  int;
  new_fail_count      int;
  new_skip_count      int;
  new_current_streak  int := 0;
  new_last_completed  date;
  log_row             RECORD;
BEGIN
  -- カウント集計
  SELECT
    COUNT(*) FILTER (WHERE status = 'complete'),
    COUNT(*) FILTER (WHERE status = 'fail'),
    COUNT(*) FILTER (WHERE status = 'skip'),
    MAX(date) FILTER (WHERE status = 'complete')
  INTO new_complete_count, new_fail_count, new_skip_count, new_last_completed
  FROM public.task_logs
  WHERE task_id = target_task_id;

  -- streak 計算（最新日付から走査）
  FOR log_row IN
    SELECT status FROM public.task_logs
    WHERE task_id = target_task_id ORDER BY date DESC
  LOOP
    IF    log_row.status = 'complete' THEN new_current_streak := new_current_streak + 1;
    ELSIF log_row.status = 'skip'    THEN CONTINUE;
    ELSIF log_row.status = 'fail'    THEN EXIT;
    END IF;
  END LOOP;

  -- task_stash 更新
  UPDATE public.task_stash SET
    complete_count      = new_complete_count,
    fail_count          = new_fail_count,
    skip_count          = new_skip_count,
    current_streak      = new_current_streak,
    last_completed_date = new_last_completed,
    updated_at          = now()
  WHERE task_id = target_task_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

**登録先:** `task_logs_update_stash` (AFTER INSERT OR UPDATE OR DELETE ON task_logs)

**streak 計算ルール:**
- `complete` → `+1`
- `skip` → 維持（CONTINUE でスキップ）
- `fail` → 走査終了（`EXIT`）

**SECURITY DEFINER:** ユーザーは task_stash に UPDATE できないため、スーパーユーザー権限で実行。

---

### 7.6 `handle_new_user()` — 新規ユーザー初期データ生成

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  morning_id  uuid;
  evening_id  uuid;
  anchor_str  text := to_char(NEW.created_at::date, 'YYYY-MM-DD');
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);

  INSERT INTO public.time_slots (user_id, name, notify_at, sort_order)
    VALUES (NEW.id, '朝', '07:00', 0) RETURNING id INTO morning_id;

  INSERT INTO public.time_slots (user_id, name, notify_at, sort_order)
    VALUES (NEW.id, '夜', '21:00', 1) RETURNING id INTO evening_id;

  INSERT INTO public.tasks (user_id, time_slot_id, name, frequency, sort_order) VALUES
    (NEW.id, morning_id, '歯を磨く',         '{"type":"daily"}'::jsonb,                                         0),
    (NEW.id, morning_id, 'メールを確認する',  '{"type":"weekday","days":[1,2,3,4,5]}'::jsonb,                    1),
    (NEW.id, morning_id, '今日のタスクを見直す', '{"type":"weekday","days":[1,2,3,4,5]}'::jsonb,                 2),
    (NEW.id, morning_id, '不燃物のゴミ捨て', '{"type":"day_of_week","days":[4],"weeks_of_month":[2,4]}'::jsonb,  3),
    (NEW.id, evening_id, '運動する',
      jsonb_build_object('type','every_n_days','n',3,'anchor',anchor_str), 0),
    (NEW.id, evening_id, '掃除する',
      jsonb_build_object('type','every_n_weeks','n',2,'day_of_week',6,'anchor',anchor_str), 1);

  RETURN NEW;
END;
$$;
```

**登録先:** `on_auth_user_created` (AFTER INSERT ON auth.users)

**生成される初期データ:**

| 時間帯 | 通知時刻 | タスク名 | 頻度 |
|-------|---------|--------|------|
| 朝 | 07:00 | 歯を磨く | 毎日 |
| 朝 | 07:00 | メールを確認する | 月〜金 |
| 朝 | 07:00 | 今日のタスクを見直す | 月〜金 |
| 朝 | 07:00 | 不燃物のゴミ捨て | 第2・第4木曜 |
| 夜 | 21:00 | 運動する | 3日ごと（登録日 anchor） |
| 夜 | 21:00 | 掃除する | 2週ごと土曜（登録日 anchor） |

---

## 8. インデックス一覧

| テーブル | インデックス名 | カラム | 用途 |
|---------|-------------|-------|------|
| `time_slots` | `time_slots_user_id_idx` | `(user_id, sort_order)` | ユーザーの時間帯一覧取得 |
| `tasks` | `tasks_user_id_idx` | `(user_id, archived_at)` | アクティブタスク取得（archived_at IS NULL フィルタ） |
| `tasks` | `tasks_time_slot_id_idx` | `(time_slot_id)` | 時間帯ごとのタスク取得 |
| `task_logs` | `task_logs_task_date_desc_idx` | `(task_id, date DESC)` | streak 計算（最新から走査）・履歴取得 |
| `task_logs` | `task_logs_date_idx` | `(date)` | 日付範囲フィルタ（直近 31 日取得） |

---

## 9. auth.users との連携

### 新規ユーザー作成時のデータ連鎖

```
supabase.auth.signUp() 呼び出し
    ↓ (Supabase 内部)
auth.users に行が INSERT される
    ↓ (AFTER INSERT トリガー)
on_auth_user_created → handle_new_user() 実行 (SECURITY DEFINER)
    ├── profiles に行を INSERT
    ├── time_slots に「朝」「夜」を INSERT
    └── tasks に 6 件 INSERT
            ↓ (各 task の AFTER INSERT トリガー)
        tasks_init_stash → init_task_stash() 実行
            └── task_stash に行を INSERT（初期値 0）
```

### ユーザー削除時の CASCADE 削除

```
auth.users の行を DELETE
    ├── profiles.id FK ON DELETE CASCADE → profiles 行削除
    ├── time_slots.user_id FK ON DELETE CASCADE → time_slots 行削除
    └── tasks.user_id FK ON DELETE CASCADE → tasks 行削除
            ├── task_logs.task_id FK ON DELETE CASCADE → task_logs 行削除
            └── task_stash.task_id FK ON DELETE CASCADE → task_stash 行削除
```

---

## 10. Realtime Publication

Supabase の `supabase_realtime` publication に登録されたテーブルは、変更時に postgres_changes イベントを発火する。

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_stash;
```

| テーブル | publication 登録 | クライアントの購読方法 |
|---------|----------------|------------------|
| `time_slots` | ✅ | `syncedSupabase({ realtime: true })` |
| `tasks` | ✅ | `syncedSupabase({ realtime: true })` |
| `task_logs` | ✅ | `syncedSupabase({ realtime: true })` |
| `task_stash` | ✅ | `supabase.channel('task_stash_view_refresh').on('postgres_changes', ...)` |
| `task_stash_view` | ❌（VIEW 不可） | task_stash の変更を検知して手動再フェッチ |

**VIEW が publication 登録不可の理由:** Supabase Realtime は論理レプリケーションを使用しており、VIEW の変更は WAL に記録されないため。

---

## 11. データフロー

### タスクログ記録から集計反映までの流れ

```
[クライアント]
ユーザーが「完了」ボタンをクリック
    ↓
setTaskLogStatus(taskId, date, 'complete')
    ↓
state$.task_logs['${taskId}-${date}'].set({ status: 'complete', ... })  ← 楽観的更新
    ↓
Legend State → syncedSupabase → Supabase API
    ↓ (HTTP リクエスト)

[サーバー（PostgreSQL）]
task_logs に UPSERT
    ↓ (AFTER INSERT/UPDATE トリガー)
task_logs_update_stash → update_task_stash()
    ↓
task_stash の complete_count, current_streak, last_completed_date 等を再計算・UPDATE

[Supabase Realtime]
task_stash テーブルの変更 → postgres_changes イベント発火

[クライアント]
channel('task_stash_view_refresh').on('postgres_changes', payload => ...)
    ↓
supabase.from('task_stash_view').select('*').eq('task_id', taskId)
    ↓
state$.task_stash_view[taskId].set(data)
    ↓
スタッシュ画面のUIが自動更新（Legend State のリアクティブ性）
```

---

## 12. アプリ型定義との対応

`packages/habit-sync/src/types.ts` では Supabase 生成型（`db-types.ts`）を短縮名で再エクスポートしている。

```typescript
// Supabase 生成型 → アプリ型エイリアス
type Task          = Database['public']['Tables']['tasks']['Row'];
type TaskInsert    = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate    = Database['public']['Tables']['tasks']['Update'];

type TimeSlot      = Database['public']['Tables']['time_slots']['Row'];
type TimeSlotInsert = Database['public']['Tables']['time_slots']['Insert'];
type TimeSlotUpdate = Database['public']['Tables']['time_slots']['Update'];

type TaskLog       = Database['public']['Tables']['task_logs']['Row'];
type TaskLogInsert = Database['public']['Tables']['task_logs']['Insert'];
type TaskLogUpdate = Database['public']['Tables']['task_logs']['Update'];

type TaskStashView = Database['public']['Views']['task_stash_view']['Row'];

type TaskStatus    = Database['public']['Enums']['task_status'];
// = 'complete' | 'skip' | 'fail'
```

**型生成コマンド:**
```bash
supabase gen types typescript --local --schema public \
  > packages/habit-sync/src/db-types.ts
```

スキーマ変更後は必ず型を再生成し、コミットすること。
