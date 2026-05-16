# Habits App — M2: Supabase 基盤 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5 / §8 の Supabase 基盤を完全に立ち上げ、`supabase start` でローカル環境が起動し、11 のマイグレーションがすべて適用され、psql で `is_due_on` / トリガー / 初期データ自動生成が動くことを確認できる状態にする。

**Architecture:** `supabase init` で Docker ベースのローカル Supabase を立ち上げ、`supabase/migrations/` に 11 ファイルの SQL マイグレーションを置く。集計はトリガー駆動の `task_stash` テーブル + 読み取り時計算の `task_stash_view`。`auth.users` INSERT トリガーで profiles + 初期 time_slots(朝/夜) + 初期タスク 6 件を自動生成。生成された TypeScript 型を `packages/habit-sync/src/db-types.ts` に取り込む。

**Tech Stack:** Supabase CLI / PostgreSQL 15+ / Docker / pgcrypto / plpgsql / supabase-js TypeScript 型生成

**前提条件:**
- M1 完了済（commit `89a577f` まで）
- Docker Desktop が起動していること（`supabase start` に必要）
- `supabase` CLI がインストール済 or Homebrew でインストール可能（`brew install supabase/tap/supabase`）
- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5 / §8

---

## ファイル構造（作成・変更対象）

```
supabase/                                             新規（supabase init で生成）
  config.toml                                          自動生成
  .gitignore                                           自動生成
  seed.sql                                             空（M2 では未使用）
  migrations/
    20260516000001_extensions.sql                      新規（pgcrypto / uuid-ossp 等）
    20260516000002_profiles.sql                        新規（profiles + RLS）
    20260516000003_time_slots.sql                      新規（time_slots + RLS）
    20260516000004_tasks.sql                           新規（tasks + frequency CHECK + RLS）
    20260516000005_task_logs.sql                       新規（task_logs + RLS + INDEX）
    20260516000006_task_stash.sql                      新規（task_stash + RLS + tasks INSERT トリガー）
    20260516000007_frequency_function.sql              新規（is_due_on() + compute_task_days()）
    20260516000008_task_stash_view.sql                 新規（task_stash_view）
    20260516000009_triggers.sql                        新規（task_logs → task_stash 反映トリガー）
    20260516000010_realtime.sql                        新規（Realtime publication 登録）
    20260516000011_initial_user_data.sql               新規（auth.users INSERT → 初期データ自動生成）

apps/habits/.env.local.example                         新規（環境変数テンプレ）
apps/habits/.gitignore                                 新規（.env.local を除外）
packages/habit-sync/src/db-types.ts                    新規（supabase gen types 出力）
CLAUDE.md                                              修正（Supabase 関連コマンド追記）
.gitignore                                             修正（supabase ローカル成果物の除外）
```

**依存方向への影響:** なし（既存の `apps/habits → packages/habit-sync` の流れに `db-types.ts` を取り込むのみ）

---

## Task 1: `supabase init` でローカルワークスペースを生成

**目的:** `supabase/` ディレクトリを生成し、`supabase start` で Docker ベースのローカル環境が立ち上がることを確認する。

**Files:**
- Create: `supabase/config.toml`（自動生成）
- Create: `supabase/seed.sql`（自動生成、空のまま）
- Modify: `.gitignore`

- [ ] **Step 1: supabase CLI がインストール済か確認**

```bash
supabase --version
```

Expected: `1.x.x` のようなバージョン番号。インストールされていなければ次のコマンドを実行:

```bash
brew install supabase/tap/supabase
```

- [ ] **Step 2: Docker が起動しているか確認**

```bash
docker info > /dev/null 2>&1 && echo "Docker OK" || echo "Docker NOT running"
```

Expected: `Docker OK`。`Docker NOT running` ならば Docker Desktop を起動してから次に進む。

- [ ] **Step 3: workspace ルートで `supabase init`**

```bash
supabase init
```

Expected: `supabase/config.toml`, `supabase/seed.sql`, `supabase/.gitignore` が生成される。`Generate VS Code settings...` などの確認には `N` で良い。

- [ ] **Step 4: 既存の `.gitignore` を確認**

```bash
grep -n "supabase" .gitignore || echo "no supabase entries"
```

ルート `.gitignore` に supabase 関連のエントリがない場合、以下を追記する（`supabase/.gitignore` がローカル成果物を除外しているはずだが、ルートにも明示する）:

```
# Supabase ローカル成果物
supabase/.branches/
supabase/.temp/
```

ファイル末尾に追記する。

- [ ] **Step 5: `supabase start` でローカル環境を起動**

```bash
supabase start
```

Expected: 数分で Docker コンテナが起動し、最後に以下のような出力が表示される:

```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
anon key: eyJhbGci...（80文字程度の JWT）
service_role key: eyJhbGci...
```

`anon key` の値をメモする（Task 14 で `.env.local.example` に書き込む）。

- [ ] **Step 6: Studio が開けることを確認**

```bash
curl -sS http://localhost:54323/ -o /dev/null -w "HTTP %{http_code}\n"
```

Expected: `HTTP 200`。

- [ ] **Step 7: 一度停止して、生成された設定をコミット**

```bash
supabase stop
```

Expected: コンテナが停止する。

```bash
git add supabase/ .gitignore
git status --short
```

Expected: `A supabase/config.toml`, `A supabase/seed.sql`, `A supabase/.gitignore`, `M .gitignore` などが並ぶ。

```bash
git commit -m "$(cat <<'EOF'
chore(supabase): supabase init でローカルワークスペースを生成

Docker ベースのローカル Supabase を立ち上げるための初期設定。
M2 で 11 マイグレーションを supabase/migrations/ 配下に追加する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit-gate hook 緑、commit 成功。

---

## Task 2: 拡張機能マイグレーション

**目的:** `pgcrypto`（`gen_random_uuid()` 用）と必要な拡張を有効化する。

**Files:**
- Create: `supabase/migrations/20260516000001_extensions.sql`

- [ ] **Step 1: マイグレーションファイル作成**

```bash
mkdir -p supabase/migrations
```

`supabase/migrations/20260516000001_extensions.sql`:

```sql
-- M2 マイグレーション 1: 拡張機能
-- pgcrypto: gen_random_uuid() を使うため
-- Supabase の最近のバージョンではデフォルトで有効だが明示的に保証する

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
```

- [ ] **Step 2: ローカル DB に適用して構文エラーがないか確認**

```bash
supabase start
supabase db reset
```

`supabase db reset` は DB を完全リセットして全マイグレーションを再適用する。Expected: エラーなく完了。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260516000001_extensions.sql
git commit -m "$(cat <<'EOF'
feat(supabase): 拡張機能マイグレーション (pgcrypto)

gen_random_uuid() のため pgcrypto を明示的に有効化。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `profiles` テーブル + RLS

**目的:** `auth.users` に紐づく `profiles` テーブルを作成し、RLS で各ユーザーが自分の行のみ参照/更新できるようにする。

**Files:**
- Create: `supabase/migrations/20260516000002_profiles.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000002_profiles.sql`:

```sql
-- M2 マイグレーション 2: profiles テーブル
-- 各ユーザーの公開プロフィール情報（M2 時点では id のみ。将来 SNS ログイン時に拡張）

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: テーブル存在確認**

```bash
supabase db dump --local --schema public 2>&1 | grep -i "CREATE TABLE.*profiles" | head -3
```

Expected: `CREATE TABLE public.profiles` が出力される。

または psql で確認:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\\dt public.profiles"
```

Expected: profiles テーブルが表示される。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000002_profiles.sql
git commit -m "$(cat <<'EOF'
feat(supabase): profiles テーブル + RLS

auth.users と 1:1 で紐づくプロフィール。
RLS で各ユーザーは自分の行のみ参照/更新可。
updated_at の自動更新トリガー付き。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `time_slots` テーブル + RLS

**目的:** ユーザーごとの時間帯（朝・夜...）を管理する `time_slots` テーブルを作成する。各時間帯は通知時刻 `notify_at` を持つ。

**Files:**
- Create: `supabase/migrations/20260516000003_time_slots.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000003_time_slots.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260516000003_time_slots.sql
git commit -m "$(cat <<'EOF'
feat(supabase): time_slots テーブル + RLS

ユーザーごとの時間帯（朝・夜...）。
時間帯ごとに通知時刻 notify_at (HH:MM:SS) を持つ。
RLS で本人のみ操作可、updated_at の自動更新付き。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `tasks` テーブル + frequency CHECK + RLS

**目的:** タスクテンプレートテーブル。`frequency` カラムは jsonb で頻度ルールを保持し、CHECK 制約で 5 つの type 値のみ許可する。

**Files:**
- Create: `supabase/migrations/20260516000004_tasks.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000004_tasks.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: CHECK 制約の動作確認**

`psql` で不正な type を入れて拒否されることを確認:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" <<'EOF'
-- 不正な type で INSERT してエラーになることを確認
BEGIN;
INSERT INTO public.tasks (user_id, time_slot_id, name, frequency)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'test', '{"type":"bogus"}');
ROLLBACK;
EOF
```

Expected: `ERROR:  new row for relation "tasks" violates check constraint "tasks_frequency_type_check"` または FK 違反（user_id が存在しないため）。CHECK 制約のエラーが出れば成功。

> **注:** FK エラーが先に出る可能性もある。その場合は CHECK のテストには別の方法（一時的に user_id FK を抜くなど）が必要だが、本タスクでは CHECK の SQL 構文だけ確認できれば良い。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000004_tasks.sql
git commit -m "$(cat <<'EOF'
feat(supabase): tasks テーブル + frequency CHECK + RLS

頻度ルールは jsonb で保持し、CHECK 制約で 5 つの type を限定。
soft delete のため archived_at カラム、time_slot 削除は RESTRICT で防御。
RLS で本人のみ操作可、updated_at の自動更新付き。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `task_logs` テーブル + RLS + INDEX

**目的:** タスクごとの (日付, status) 記録。`empty` は行の不在で表現するため、status は `'complete' | 'skip' | 'fail'` の 3 値のみ。

**Files:**
- Create: `supabase/migrations/20260516000005_task_logs.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000005_task_logs.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260516000005_task_logs.sql
git commit -m "$(cat <<'EOF'
feat(supabase): task_logs テーブル + RLS + INDEX

PRIMARY KEY (task_id, date) で 1 タスク 1 日 1 行を保証。
status enum は complete/skip/fail の 3 値（empty は行不在で表現）。
streak 計算用に (task_id, date DESC) INDEX。
RLS は tasks 経由で user_id をチェック。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `task_stash` テーブル + RLS + tasks INSERT トリガー

**目的:** トリガーで更新される集計テーブル。タスク作成時に自動で 0 値の行を作る。RLS は読み取りのみ許可し、書き込みはトリガー（SECURITY DEFINER）経由。

**Files:**
- Create: `supabase/migrations/20260516000006_task_stash.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000006_task_stash.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260516000006_task_stash.sql
git commit -m "$(cat <<'EOF'
feat(supabase): task_stash テーブル + RLS + tasks INSERT トリガー

集計テーブル。ユーザーは SELECT のみ可、書き込みはトリガー経由。
tasks INSERT で task_stash 行を 0 値で自動初期化。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `is_due_on()` SQL 関数

**目的:** 頻度ルール（jsonb）と target_date / anchor_date を引数に、その日にタスクが該当するかを判定する純粋関数。`task_stash_view` の計算で使う。設計仕様 §5.2 のすべての type バリアントをカバー。

**Files:**
- Create: `supabase/migrations/20260516000007_frequency_function.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000007_frequency_function.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: 各 type の動作を psql で検証**

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" <<'EOF'
-- daily: 常に true（anchor 以降）
SELECT 'daily-1' AS case, public.is_due_on('{"type":"daily"}', '2026-05-16', '2026-01-01') AS result; -- t
SELECT 'daily-2' AS case, public.is_due_on('{"type":"daily"}', '2026-01-01', '2026-01-01') AS result; -- t
SELECT 'daily-3' AS case, public.is_due_on('{"type":"daily"}', '2025-12-31', '2026-01-01') AS result; -- f (anchor 前)

-- every_n_days: 3 日に 1 回, anchor=2026-05-01
SELECT 'n_days-1' AS case, public.is_due_on('{"type":"every_n_days","n":3,"anchor":"2026-05-01"}', '2026-05-01', '2026-05-01') AS result; -- t
SELECT 'n_days-2' AS case, public.is_due_on('{"type":"every_n_days","n":3,"anchor":"2026-05-01"}', '2026-05-04', '2026-05-01') AS result; -- t
SELECT 'n_days-3' AS case, public.is_due_on('{"type":"every_n_days","n":3,"anchor":"2026-05-01"}', '2026-05-05', '2026-05-01') AS result; -- f
SELECT 'n_days-4' AS case, public.is_due_on('{"type":"every_n_days","n":3,"anchor":"2026-05-01"}', '2026-05-07', '2026-05-01') AS result; -- t

-- weekday: 月-金 (1-5)
SELECT 'weekday-1' AS case, public.is_due_on('{"type":"weekday","days":[1,2,3,4,5]}', '2026-05-15', '2026-01-01') AS result; -- t (金)
SELECT 'weekday-2' AS case, public.is_due_on('{"type":"weekday","days":[1,2,3,4,5]}', '2026-05-16', '2026-01-01') AS result; -- f (土)
SELECT 'weekday-3' AS case, public.is_due_on('{"type":"weekday","days":[1,2,3,4,5]}', '2026-05-17', '2026-01-01') AS result; -- f (日)

-- day_of_week: 第 2/第 4 木曜
SELECT 'dow-1' AS case, public.is_due_on('{"type":"day_of_week","days":[4],"weeks_of_month":[2,4]}', '2026-05-07', '2026-01-01') AS result; -- f (第 1 木曜)
SELECT 'dow-2' AS case, public.is_due_on('{"type":"day_of_week","days":[4],"weeks_of_month":[2,4]}', '2026-05-14', '2026-01-01') AS result; -- t (第 2 木曜)
SELECT 'dow-3' AS case, public.is_due_on('{"type":"day_of_week","days":[4],"weeks_of_month":[2,4]}', '2026-05-21', '2026-01-01') AS result; -- f (第 3 木曜)
SELECT 'dow-4' AS case, public.is_due_on('{"type":"day_of_week","days":[4],"weeks_of_month":[2,4]}', '2026-05-28', '2026-01-01') AS result; -- t (第 4 木曜)

-- day_of_week without weeks_of_month: 毎週木曜
SELECT 'dow-5' AS case, public.is_due_on('{"type":"day_of_week","days":[4]}', '2026-05-07', '2026-01-01') AS result; -- t
SELECT 'dow-6' AS case, public.is_due_on('{"type":"day_of_week","days":[4]}', '2026-05-08', '2026-01-01') AS result; -- f (金)

-- every_n_weeks: 2 週に 1 回 土曜, anchor=2026-05-01 (金)
-- first_match_date = 2026-05-02 (土)
SELECT 'n_weeks-1' AS case, public.is_due_on('{"type":"every_n_weeks","n":2,"day_of_week":6,"anchor":"2026-05-01"}', '2026-05-02', '2026-05-01') AS result; -- t
SELECT 'n_weeks-2' AS case, public.is_due_on('{"type":"every_n_weeks","n":2,"day_of_week":6,"anchor":"2026-05-01"}', '2026-05-09', '2026-05-01') AS result; -- f (1 週後)
SELECT 'n_weeks-3' AS case, public.is_due_on('{"type":"every_n_weeks","n":2,"day_of_week":6,"anchor":"2026-05-01"}', '2026-05-16', '2026-05-01') AS result; -- t (2 週後)
SELECT 'n_weeks-4' AS case, public.is_due_on('{"type":"every_n_weeks","n":2,"day_of_week":6,"anchor":"2026-05-01"}', '2026-05-15', '2026-05-01') AS result; -- f (金, 曜日違い)
EOF
```

Expected 出力: すべて期待通り (`t` / `f` がコメント通り)。期待と違う行があれば SQL を見直す。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000007_frequency_function.sql
git commit -m "$(cat <<'EOF'
feat(supabase): is_due_on / compute_task_days 関数

頻度ルール (jsonb) で指定日に該当するかを判定する純粋関数。
5 つの type バリアント (daily / every_n_days / weekday / day_of_week / every_n_weeks)
を網羅。TypeScript 側 habit-core/src/frequency.ts と同等のロジック。

compute_task_days は task_stash_view から使う。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `task_stash_view`

**目的:** `task_stash` テーブルに `task_days` と `completion_rate` を補完した VIEW を提供する。アプリは `task_stash_view` を購読する。

**Files:**
- Create: `supabase/migrations/20260516000008_task_stash_view.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000008_task_stash_view.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: VIEW の構造を確認**

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\\d+ public.task_stash_view"
```

Expected: カラム一覧に `task_id, user_id, complete_count, fail_count, skip_count, current_streak, last_completed_date, task_days, completion_rate, updated_at` が並ぶ。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000008_task_stash_view.sql
git commit -m "$(cat <<'EOF'
feat(supabase): task_stash_view (task_days / completion_rate 補完)

task_stash テーブルに以下を加えた読み取り専用 VIEW。
- task_days: (created_at 以降で is_due_on が真の日数) - skip_count
- completion_rate: complete_count / task_days (NULL safe)

security_invoker=true で利用者の RLS（task_stash / tasks）が適用される。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `task_logs` → `task_stash` 反映トリガー

**目的:** `task_logs` の INSERT/UPDATE/DELETE で対応する `task_stash` 行を再集計するトリガーを設定する。streak 計算ロジックも含む。

**Files:**
- Create: `supabase/migrations/20260516000009_triggers.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000009_triggers.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: トリガーの動作を psql で検証**

`supabase` の auth.users に直接行を作成して、task_logs の挿入と stash の更新を確認:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" <<'EOF'
-- 検証用テストデータ作成
INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@example.com', '', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.profiles (id) VALUES ('11111111-1111-1111-1111-111111111111');

INSERT INTO public.time_slots (id, user_id, name, notify_at, sort_order)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '朝', '07:00', 0);

INSERT INTO public.tasks (id, user_id, time_slot_id, name, frequency)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'test', '{"type":"daily"}');

-- 初期 stash: すべて 0
SELECT 'initial' AS phase, complete_count, fail_count, skip_count, current_streak FROM public.task_stash WHERE task_id = '33333333-3333-3333-3333-333333333333';

-- log INSERT: complete x 3, skip x 1, complete x 1
INSERT INTO public.task_logs (task_id, date, status) VALUES
  ('33333333-3333-3333-3333-333333333333', '2026-05-12', 'complete'),
  ('33333333-3333-3333-3333-333333333333', '2026-05-13', 'complete'),
  ('33333333-3333-3333-3333-333333333333', '2026-05-14', 'complete'),
  ('33333333-3333-3333-3333-333333333333', '2026-05-15', 'skip'),
  ('33333333-3333-3333-3333-333333333333', '2026-05-16', 'complete');

SELECT 'after_inserts' AS phase, complete_count, fail_count, skip_count, current_streak, last_completed_date FROM public.task_stash WHERE task_id = '33333333-3333-3333-3333-333333333333';
-- expected: complete=4, fail=0, skip=1, current_streak=4 (5/16 complete -> +1, 5/15 skip -> 維持, 5/14,5/13,5/12 complete -> +3), last_completed_date=2026-05-16

-- fail を間に入れて streak がリセットされることを確認
UPDATE public.task_logs SET status = 'fail' WHERE task_id = '33333333-3333-3333-3333-333333333333' AND date = '2026-05-13';

SELECT 'after_fail' AS phase, complete_count, fail_count, skip_count, current_streak FROM public.task_stash WHERE task_id = '33333333-3333-3333-3333-333333333333';
-- expected: complete=3, fail=1, skip=1, current_streak=2 (5/16 complete +1, 5/15 skip 維持, 5/14 complete +1, 5/13 fail -> 打ち切り)

-- クリーンアップ
DELETE FROM auth.users WHERE id = '11111111-1111-1111-1111-111111111111';
EOF
```

Expected: 
- `initial` 行: complete_count=0, fail_count=0, skip_count=0, current_streak=0
- `after_inserts` 行: complete_count=4, fail_count=0, skip_count=1, current_streak=4, last_completed_date=2026-05-16
- `after_fail` 行: complete_count=3, fail_count=1, skip_count=1, current_streak=2

期待と違う場合は streak 計算ロジックを見直す。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000009_triggers.sql
git commit -m "$(cat <<'EOF'
feat(supabase): task_logs → task_stash 反映トリガー

INSERT/UPDATE/DELETE で対応する task_stash 行を再集計。
streak ルール: complete=+1, skip=維持, fail=打ち切り。
SECURITY DEFINER でユーザーの書き込み権限を持たない task_stash を更新。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Realtime publication 登録

**目的:** legend-state の Realtime 購読のため、対象テーブルを Supabase の `supabase_realtime` publication に追加する。

**Files:**
- Create: `supabase/migrations/20260516000010_realtime.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000010_realtime.sql`:

```sql
-- M2 マイグレーション 10: Realtime publication
-- legend-state の syncedSupabase からリアルタイム購読するテーブルを登録。
-- 詳細仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md §5.4

-- supabase_realtime publication は Supabase が自動作成済み。
-- 既に登録されているテーブルがあればエラーになるため、明示的に追加する。

ALTER PUBLICATION supabase_realtime ADD TABLE public.time_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_stash;
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: publication の登録テーブルを確認**

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;"
```

Expected: `time_slots`, `tasks`, `task_logs`, `task_stash` の 4 テーブルが含まれる。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000010_realtime.sql
git commit -m "$(cat <<'EOF'
feat(supabase): Realtime publication 登録

time_slots / tasks / task_logs / task_stash を supabase_realtime に追加。
M5 で legend-state の syncedSupabase が変更を購読する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 初期データ自動生成トリガー

**目的:** `auth.users` INSERT 時に profiles + 初期 time_slots (朝/夜) + 初期タスク 6 件を自動作成する。設計仕様 §5.5 の初期データを完全に再現する。

**Files:**
- Create: `supabase/migrations/20260516000011_initial_user_data.sql`

- [ ] **Step 1: マイグレーション作成**

`supabase/migrations/20260516000011_initial_user_data.sql`:

```sql
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
```

- [ ] **Step 2: 適用確認**

```bash
supabase db reset
```

Expected: エラーなし。

- [ ] **Step 3: 新規ユーザー作成で初期データが揃うことを確認**

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" <<'EOF'
-- 新規ユーザー作成（emil/password は値を持たないが、トリガーは id だけ使うので OK）
INSERT INTO auth.users (id, email, encrypted_password, instance_id, aud, role)
VALUES ('55555555-5555-5555-5555-555555555555', 'newuser@example.com', '', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- profiles: 1 件
SELECT 'profiles_count' AS k, COUNT(*) AS v FROM public.profiles WHERE id = '55555555-5555-5555-5555-555555555555';
-- expected: 1

-- time_slots: 2 件 (朝, 夜)
SELECT name, notify_at, sort_order FROM public.time_slots WHERE user_id = '55555555-5555-5555-5555-555555555555' ORDER BY sort_order;
-- expected: 朝 07:00:00 0, 夜 21:00:00 1

-- tasks: 6 件
SELECT name, frequency->>'type' AS type, sort_order FROM public.tasks WHERE user_id = '55555555-5555-5555-5555-555555555555' ORDER BY time_slot_id, sort_order;
-- expected:
--   歯を磨く        daily          0
--   メールを確認する weekday        1
--   今日のタスクを見直す weekday    2
--   不燃物のゴミ捨て day_of_week    3
--   運動する        every_n_days   0
--   掃除する        every_n_weeks  1

-- task_stash: 6 件（tasks INSERT トリガーで自動作成）
SELECT 'stash_count' AS k, COUNT(*) AS v FROM public.task_stash ts
  INNER JOIN public.tasks t ON t.id = ts.task_id
  WHERE t.user_id = '55555555-5555-5555-5555-555555555555';
-- expected: 6

-- クリーンアップ（CASCADE で全部消える）
DELETE FROM auth.users WHERE id = '55555555-5555-5555-5555-555555555555';
EOF
```

Expected:
- profiles_count = 1
- time_slots: 朝/夜の 2 行
- tasks: 6 行で type が `daily, weekday, weekday, day_of_week, every_n_days, every_n_weeks` の順
- stash_count = 6

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/20260516000011_initial_user_data.sql
git commit -m "$(cat <<'EOF'
feat(supabase): 新規ユーザー作成時の初期データ自動生成トリガー

auth.users INSERT で以下を自動生成:
- profiles 1 行
- time_slots 2 行（朝 07:00 / 夜 21:00）
- tasks 6 件（仕様 §5.5 の初期タスク）

夜 21:00 / 掃除土曜は仕様未指定のための合理的デフォルト。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: TypeScript 型生成 → `packages/habit-sync/src/db-types.ts`

**目的:** Supabase の `gen types typescript` で DB スキーマから TS 型を生成し、`packages/habit-sync` に取り込む。M5 以降の同期実装で `Database` 型を使う。

**Files:**
- Create: `packages/habit-sync/src/db-types.ts`
- Modify: `packages/habit-sync/src/index.ts`（型 re-export を追加）

- [ ] **Step 1: 型生成コマンド実行**

```bash
supabase gen types typescript --local --schema public > packages/habit-sync/src/db-types.ts
```

Expected: `packages/habit-sync/src/db-types.ts` が生成される。先頭に `export type Json = ...` や `export interface Database { ... }` が出力されることを確認。

```bash
head -10 packages/habit-sync/src/db-types.ts
```

Expected: TypeScript の型定義（`export type Json` や `Database` インタフェース等）が表示される。

- [ ] **Step 2: 生成された型を `index.ts` から re-export**

`packages/habit-sync/src/index.ts` の末尾に以下を追記する:

```ts
// Supabase の TS 型（supabase gen types typescript --local で再生成可能）
export type { Database, Json } from './db-types.js';
```

- [ ] **Step 3: typecheck / test がパスすることを確認**

```bash
CI=true pnpm nx run @org/habit-sync:typecheck
CI=true pnpm nx run @org/habit-sync:test
pnpm exec biome ci packages/habit-sync/
```

Expected: すべて緑。test カウントは M1 から変わらず 4 件。

> **注:** Biome の lint で `noExplicitAny` 等が生成コードに引っかかる場合がある。その場合は `packages/habit-sync/biome.json` で `db-types.ts` を override する:
> ```json
> {
>   "root": false,
>   "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
>   "extends": ["@org/config-biome/biome.json"],
>   "overrides": [
>     { "include": ["src/db-types.ts"], "linter": { "enabled": false }, "formatter": { "enabled": false } }
>   ]
> }
> ```
> ただし最近の `supabase gen types` は Biome 互換のコードを出すことが多いので、まずはそのままで試す。

- [ ] **Step 4: コミット**

```bash
git add packages/habit-sync/src/db-types.ts packages/habit-sync/src/index.ts packages/habit-sync/biome.json
git commit -m "$(cat <<'EOF'
feat(habit-sync): Supabase スキーマから生成した TS 型を取り込み

supabase gen types typescript --local で生成した Database 型を
packages/habit-sync/src/db-types.ts に配置。
公開 API として Database / Json 型を re-export。

スキーマ変更時は同コマンドで再生成する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: `apps/habits/.env.local.example` + `.gitignore`

**目的:** ローカル Supabase の接続情報をテンプレ化する。実際の `.env.local` は各開発者が `supabase start` の出力をコピペして作成する（Git 管理外）。

**Files:**
- Create: `apps/habits/.env.local.example`
- Create: `apps/habits/.gitignore`

- [ ] **Step 1: `apps/habits/.env.local.example`**

```bash
cat > apps/habits/.env.local.example <<'EOF'
# Supabase ローカル開発用環境変数
# 各値は `supabase start` 出力の "API URL" と "anon key" をコピーする。
# 本ファイルをコピーして `.env.local` を作成（Git 管理外）。

VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...（supabase start の anon key をここに）
EOF
```

- [ ] **Step 2: `apps/habits/.gitignore`**

```bash
cat > apps/habits/.gitignore <<'EOF'
# 環境変数
.env.local
.env.*.local

# ビルド成果物
dist/
.vite/
EOF
```

- [ ] **Step 3: コミット**

```bash
git add apps/habits/.env.local.example apps/habits/.gitignore
git commit -m "$(cat <<'EOF'
chore(habits): .env.local.example と .gitignore を追加

Supabase ローカル接続情報のテンプレ。各開発者は supabase start の
出力をコピーして .env.local を作成する（Git 管理外）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: CLAUDE.md に Supabase 運用コマンドを追記 + M2 完了検証

**目的:** チーム（および Claude エージェント）が `supabase start` / `db reset` / `gen types` を把握できるよう CLAUDE.md を更新。最後に M2 全体を検証する。

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md の主要コマンドセクションに追記**

`CLAUDE.md` の `## 主要コマンド` セクションの末尾（` ``` ` 直前）に以下を追加:

```bash
# Supabase（ローカル開発）
supabase start                                    # Docker でローカル環境起動（API:54321, DB:54322, Studio:54323）
supabase stop                                     # 停止
supabase db reset                                 # DB 完全リセットして全マイグレーション再適用
supabase migration new <name>                     # 新規マイグレーションファイル作成（タイムスタンプ自動付与）
supabase gen types typescript --local --schema public > packages/habit-sync/src/db-types.ts  # 型生成
```

- [ ] **Step 2: CLAUDE.md にローカル Supabase の注意セクションを追加**

`## E2E（Playwright）` セクションの直前に新しいセクションを追加:

```markdown
## Supabase ローカル開発

- 起動には Docker Desktop が必要（macOS）
- `supabase start` の出力に表示される `anon key` を `apps/habits/.env.local` に転記する（`.env.local.example` 参照）
- マイグレーションは `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` の順序で適用される
- スキーマ変更後は `supabase db reset` で完全再適用し、`supabase gen types ...` で TS 型を更新
- RLS は全テーブルで有効。本人 (`auth.uid() = user_id`) のみ操作可
- 集計（task_stash）はトリガー駆動。task_stash_view が task_days / completion_rate を補完
- 詳細は `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5 / §8
```

- [ ] **Step 3: M2 完了の総合検証**

```bash
# 1. ローカル DB をクリーンに再適用
supabase db reset

# 2. 全マイグレーションが適用されたことを確認
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\\dt public.*"
# Expected: profiles, time_slots, tasks, task_logs, task_stash の 5 テーブルが並ぶ

# 3. VIEW を確認
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\\dv public.*"
# Expected: task_stash_view

# 4. 関数を確認
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "\\df public.*"
# Expected: handle_new_user, init_task_stash, is_due_on, compute_task_days, set_updated_at, update_task_stash

# 5. Realtime publication を確認
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;"
# Expected: task_logs, task_stash, tasks, time_slots

# 6. 既存の workspace test がすべて緑
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
# Expected: 5 projects all green

# 7. biome ci
pnpm exec biome ci .
# Expected: 全ファイル緑
```

Expected: すべて期待通りに通る。

- [ ] **Step 4: CLAUDE.md の変更をコミット**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: CLAUDE.md に Supabase 運用コマンドと注意セクションを追記

supabase start / db reset / migration new / gen types の主要コマンドと、
ローカル開発の注意事項（Docker 要件、anon key の取得方法、RLS、集計の仕組み）を記載。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 次のマイルストーン

このプラン完了後、次は **M3: 認証フロー** の実装プランを `docs/superpowers/plans/2026-05-16-habits-app-m3-auth.md` として作成する。M3 で扱う内容:

- `apps/habits/src/lib/supabase.ts` で `getSupabaseClient` を `.env.local` から初期化
- `apps/habits/src/lib/auth.ts` で signUp / signIn / signOut / onAuthStateChange ラッパー
- `/auth/login` と `/auth/signup` の実コンポーネント実装
- `AuthGate` で未認証時に `/auth/login` へリダイレクト
- サインアップ→初期データ自動生成→`/today` 着地までの E2E 動作確認（Playwright は M12 で本格化、M3 は手動 + vitest でカバー）
