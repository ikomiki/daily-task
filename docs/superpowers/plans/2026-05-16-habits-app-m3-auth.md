# Habits App — M3: 認証フロー 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6.2 / §8.1 の認証フローを完成させ、`pnpm nx serve habits` で `/auth/signup` から新規登録 → 自動的に `/today` に遷移し、M2 のトリガーで作られた 6 件の初期タスクが（プレースホルダ表示として）確認できる状態にする。

**Architecture:** Supabase Email/Password 認証をラップした薄い lib 層（`apps/habits/src/lib/{supabase,auth}.ts`）、Login / Signup の React コンポーネント、TanStack Router `beforeLoad` による `/today` の AuthGate、legend-state `state$.user` への `onAuthStateChange` ブリッジで構成する。Email 確認は dev 環境で無効化済み（`supabase/config.toml` の `enable_confirmations = false`）。

**Tech Stack:** Supabase Auth (Email/Password) / @supabase/supabase-js / TanStack Router (code-based) / legend-state v3 React hooks / React 19 / Tailwind v4 / vitest + @testing-library/react

**前提条件:**
- M2 完了済（`main` にマージ済、commit `fe69ff7` まで）
- `supabase start` でローカル環境が起動できる（M2 で構築済）
- `apps/habits/.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が設定済（`.env.local.example` を参照）
- 新規ブランチ `feature/habits-m3-auth` を `main` から切って作業
- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6.2 / §8.1 / §7.3

---

## ファイル構造（作成・変更対象）

```
apps/habits/src/
  lib/
    supabase.ts                       新規 — VITE_SUPABASE_* から SupabaseClient シングルトン生成
    supabase.test.ts                  新規
    auth.ts                           新規 — signUp / signIn / signOut / getCurrentSession / onAuthStateChange ラッパー
    auth.test.ts                      新規
  features/
    auth/
      Login.tsx                       新規 — /auth/login の本体
      Login.test.tsx                  新規
      Signup.tsx                      新規 — /auth/signup の本体
      Signup.test.tsx                 新規
      AuthForm.tsx                    新規 — Login/Signup 共通フォーム部品（email + password input + submit + error）
      AuthForm.test.tsx               新規
  features/
    today/
      Today.tsx                       新規 — /today の本体（旧 router.tsx 内の関数を抽出）
      Today.test.tsx                  新規
  hooks/
    useAuthSession.ts                 新規 — state$.user を購読、onAuthStateChange を初回サブスクライブ
    useAuthSession.test.tsx           新規
  router.tsx                          変更 — /auth/signup ルート追加、/today に beforeLoad 追加、外部コンポーネントを import
  main.tsx                            変更 — useAuthSession の初期化呼び出し（または App.tsx で）
  App.tsx                             変更 — useAuthSession を呼ぶ
  App.test.tsx                        変更 — auth state を mock しつつテスト維持
packages/habit-sync/src/
  observables.ts                      変更 — state$.user の型を Supabase の User に合わせる
  index.ts                            変更 — User 型の re-export
```

**依存方向への影響:** なし（`apps/habits → packages/habit-sync` の流れに沿う）

---

## Task 1: `apps/habits/src/lib/supabase.ts` で env-based クライアント生成

**目的:** `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を読み、`packages/habit-sync` の `getSupabaseClient` を呼んでシングルトンを返すラッパーを作る。env が未定義なら明確なエラーで落とす。

**Files:**
- Create: `apps/habits/src/lib/supabase.ts`
- Create: `apps/habits/src/lib/supabase.test.ts`

- [ ] **Step 1: テストファイル作成（fail させる）**

`apps/habits/src/lib/supabase.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSupabaseClient } from '@org/habit-sync';

describe('lib/supabase', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    resetSupabaseClient();
  });

  afterEach(() => {
    // env を元に戻す
    Object.assign(import.meta.env, originalEnv);
    vi.unstubAllEnvs();
    resetSupabaseClient();
  });

  it('VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY からクライアントを生成する', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ-dummy');
    const { getAppSupabase } = await import('./supabase.js');
    const client = getAppSupabase();
    expect(client).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });

  it('VITE_SUPABASE_URL が未定義の場合は分かりやすいエラーで落ちる', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ-dummy');
    const { getAppSupabase } = await import('./supabase.js');
    expect(() => getAppSupabase()).toThrow(/VITE_SUPABASE_URL/);
  });

  it('VITE_SUPABASE_ANON_KEY が未定義の場合は分かりやすいエラーで落ちる', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getAppSupabase } = await import('./supabase.js');
    expect(() => getAppSupabase()).toThrow(/VITE_SUPABASE_ANON_KEY/);
  });
});
```

- [ ] **Step 2: テスト実行して fail を確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/supabase.test.ts
```

Expected: `Cannot find module './supabase'` 等で fail。

- [ ] **Step 3: 最小実装**

`apps/habits/src/lib/supabase.ts`:

```ts
import { getSupabaseClient, type SupabaseConfig } from '@org/habit-sync';
import type { SupabaseClient } from '@supabase/supabase-js';

// env から SupabaseClient を取得する。habit-sync のシングルトン管理に委譲する。
// 環境変数未設定時は明確なエラーで落ち、誤って production / staging を指していないか
// 開発者がすぐ気づけるようにする。
export function getAppSupabase(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (typeof url !== 'string' || url === '') {
    throw new Error(
      'VITE_SUPABASE_URL が未設定です。apps/habits/.env.local.example を元に .env.local を作成してください。',
    );
  }
  if (typeof anonKey !== 'string' || anonKey === '') {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY が未設定です。supabase start の出力から anon key をコピーして .env.local に記載してください。',
    );
  }

  const config: SupabaseConfig = { url, anonKey };
  return getSupabaseClient(config);
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/supabase.test.ts
```

Expected: 3 件 pass。

- [ ] **Step 5: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci apps/habits/src/lib/
```

```bash
git add apps/habits/src/lib/supabase.ts apps/habits/src/lib/supabase.test.ts
git commit -m "$(cat <<'EOF'
feat(habits): env-based Supabase クライアント生成 lib

VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY から SupabaseClient を取得する
getAppSupabase() を追加。habit-sync のシングルトン管理を再利用。
env 未設定時は分かりやすい日本語エラーで落ちる。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: auth 操作ラッパー `apps/habits/src/lib/auth.ts`

**目的:** Supabase Auth API（signUp / signInWithPassword / signOut / getSession / onAuthStateChange）を薄くラップし、戻り値を `{ ok: true, ... }` / `{ ok: false, error }` の判別共用体で返す。テスト可能なように `getAppSupabase` を引数で差し替え可能にする。

**Files:**
- Create: `apps/habits/src/lib/auth.ts`
- Create: `apps/habits/src/lib/auth.test.ts`

- [ ] **Step 1: テストファイル作成**

`apps/habits/src/lib/auth.test.ts`:

```ts
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { signIn, signOut, signUp } from './auth.js';

// SupabaseClient を最小限モック
function makeMockClient(handlers: {
  signUp?: ReturnType<typeof vi.fn>;
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
}): SupabaseClient {
  return {
    auth: {
      signUp: handlers.signUp ?? vi.fn(),
      signInWithPassword: handlers.signInWithPassword ?? vi.fn(),
      signOut: handlers.signOut ?? vi.fn(),
    },
  } as unknown as SupabaseClient;
}

const dummyUser = { id: 'u1', email: 'a@b.co' } as User;
const dummySession = { user: dummyUser, access_token: 'x' } as Session;

describe('lib/auth', () => {
  describe('signUp', () => {
    it('成功時に { ok: true, user, session } を返す', async () => {
      const client = makeMockClient({
        signUp: vi.fn().mockResolvedValue({ data: { user: dummyUser, session: dummySession }, error: null }),
      });
      const result = await signUp(client, 'a@b.co', 'password123');
      expect(result).toEqual({ ok: true, user: dummyUser, session: dummySession });
    });

    it('失敗時に { ok: false, error } を返す', async () => {
      const client = makeMockClient({
        signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { message: 'invalid' } }),
      });
      const result = await signUp(client, 'a@b.co', 'short');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/invalid/);
      }
    });
  });

  describe('signIn', () => {
    it('成功時に { ok: true, user, session } を返す', async () => {
      const client = makeMockClient({
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: dummyUser, session: dummySession }, error: null }),
      });
      const result = await signIn(client, 'a@b.co', 'password123');
      expect(result).toEqual({ ok: true, user: dummyUser, session: dummySession });
    });

    it('失敗時に { ok: false, error } を返す', async () => {
      const client = makeMockClient({
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }),
      });
      const result = await signIn(client, 'a@b.co', 'wrong');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Invalid login credentials/);
      }
    });
  });

  describe('signOut', () => {
    it('成功時に { ok: true } を返す', async () => {
      const client = makeMockClient({
        signOut: vi.fn().mockResolvedValue({ error: null }),
      });
      const result = await signOut(client);
      expect(result).toEqual({ ok: true });
    });

    it('失敗時に { ok: false, error } を返す', async () => {
      const client = makeMockClient({
        signOut: vi.fn().mockResolvedValue({ error: { message: 'net' } }),
      });
      const result = await signOut(client);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/net/);
      }
    });
  });
});
```

- [ ] **Step 2: fail を確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/auth.test.ts
```

Expected: モジュールが見つからず fail。

- [ ] **Step 3: 実装**

`apps/habits/src/lib/auth.ts`:

```ts
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

// auth 操作の戻り値: 成功/失敗の判別共用体。
// 呼び出し側は `if (result.ok)` で網羅性チェック可能。
export type AuthResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export type AuthUserSession = { user: User; session: Session };

export async function signUp(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthResult<AuthUserSession>> {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error !== null) {
    return { ok: false, error: error.message };
  }
  if (data.user === null || data.session === null) {
    // Email 確認 ON の場合は session が null になる。dev では起きない想定だがフォローする。
    return { ok: false, error: 'サインアップは成功しましたが、セッションが取得できませんでした（Email 確認が有効？）。' };
  }
  return { ok: true, user: data.user, session: data.session };
}

export async function signIn(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthResult<AuthUserSession>> {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error !== null) {
    return { ok: false, error: error.message };
  }
  if (data.user === null || data.session === null) {
    return { ok: false, error: 'ログインは成功しましたが、セッションが取得できませんでした。' };
  }
  return { ok: true, user: data.user, session: data.session };
}

export async function signOut(client: SupabaseClient): Promise<AuthResult<{}>> {
  const { error } = await client.auth.signOut();
  if (error !== null) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// 起動時にセッションを取得し、変化を観測するヘルパー。
// onAuthStateChange は { data: { subscription } } を返すため、unsubscribe 関数を返す。
export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';

export type AuthStateListener = (event: AuthEvent, session: Session | null) => void;

export function subscribeAuthState(
  client: SupabaseClient,
  listener: AuthStateListener,
): () => void {
  const { data } = client.auth.onAuthStateChange((event, session) => {
    listener(event as AuthEvent, session);
  });
  return () => data.subscription.unsubscribe();
}

export async function getCurrentSession(client: SupabaseClient): Promise<Session | null> {
  const { data } = await client.auth.getSession();
  return data.session;
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/auth.test.ts
```

Expected: 6 件 pass。

- [ ] **Step 5: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci apps/habits/src/lib/
```

```bash
git add apps/habits/src/lib/auth.ts apps/habits/src/lib/auth.test.ts
git commit -m "$(cat <<'EOF'
feat(habits): auth 操作の判別共用体ラッパー

signUp / signIn / signOut / getCurrentSession / subscribeAuthState を
{ ok: true } / { ok: false, error } 形式で返す薄いラッパーとして実装。
SupabaseClient を引数で渡す形にしてテスト容易化。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 共通 `AuthForm` コンポーネント

**目的:** Login と Signup の UI 共通部分（email + password + submit + error 表示）を `AuthForm` に抽出する。バリデーションは「空でない」「メール形式」「パスワード 6 文字以上」のみのシンプルなもの。

**Files:**
- Create: `apps/habits/src/features/auth/AuthForm.tsx`
- Create: `apps/habits/src/features/auth/AuthForm.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/auth/AuthForm.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm.js';

describe('AuthForm', () => {
  it('submit ボタンに渡された label を表示する', () => {
    render(<AuthForm submitLabel="ログイン" onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('email と password を入力して submit すると onSubmit が呼ばれる', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co', password: 'password123' });
  });

  it('email が空のときは onSubmit を呼ばずバリデーションエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/メールアドレス/);
  });

  it('email 形式が不正なときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/メールアドレス/);
  });

  it('password が 6 文字未満のときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/パスワード/);
  });

  it('外部から渡された errorMessage を表示する', () => {
    render(<AuthForm submitLabel="登録" onSubmit={vi.fn()} errorMessage="サーバーエラー" />);
    expect(screen.getByRole('alert')).toHaveTextContent('サーバーエラー');
  });

  it('isSubmitting=true の間はボタンが disabled になる', () => {
    render(<AuthForm submitLabel="登録" onSubmit={vi.fn()} isSubmitting={true} />);
    expect(screen.getByRole('button', { name: '登録' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: fail を確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/auth/AuthForm.test.tsx
```

Expected: モジュール未定義で fail。

- [ ] **Step 3: 実装**

`apps/habits/src/features/auth/AuthForm.tsx`:

```tsx
import { type FormEvent, useState } from 'react';

export interface AuthFormProps {
  submitLabel: string;
  onSubmit: (values: { email: string; password: string }) => void;
  errorMessage?: string;
  isSubmitting?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function validate(email: string, password: string): string | null {
  if (email.trim() === '') {
    return 'メールアドレスを入力してください。';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'メールアドレスの形式が正しくありません。';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは ${MIN_PASSWORD_LENGTH} 文字以上で入力してください。`;
  }
  return null;
}

export function AuthForm({
  submitLabel,
  onSubmit,
  errorMessage,
  isSubmitting = false,
}: AuthFormProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const error = validate(email, password);
    if (error !== null) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onSubmit({ email, password });
  };

  const displayError = validationError ?? errorMessage ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">メールアドレス</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        />
      </label>
      {displayError !== null && (
        <p role="alert" className="text-sm text-red-400">
          {displayError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/auth/AuthForm.test.tsx
```

Expected: 7 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/auth/AuthForm.tsx apps/habits/src/features/auth/AuthForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): 共通 AuthForm コンポーネント

Login / Signup の UI 共通部分（メール + パスワード + submit + エラー表示）を抽出。
クライアント側バリデーション（メール形式、パスワード 6 文字以上）とサーバー由来エラーの両方を表示。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `Login` コンポーネント

**目的:** `/auth/login` の本体。`AuthForm` を使い、signIn 成功時に `/today` へ navigate、失敗時はエラー文を表示。

**Files:**
- Create: `apps/habits/src/features/auth/Login.tsx`
- Create: `apps/habits/src/features/auth/Login.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/auth/Login.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Login } from './Login.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signInWithPassword: vi.fn() } }),
}));

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});

const signInMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signIn: (...args: unknown[]): unknown => signInMock(...args),
}));

describe('Login', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signInMock.mockReset();
  });

  it('「ログイン」見出しと submit ボタンが表示される', () => {
    render(<Login />);
    expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('サインアップへのリンクがある', () => {
    render(<Login />);
    expect(screen.getByRole('link', { name: /アカウントをお持ちでない方/ })).toBeInTheDocument();
  });

  it('submit 成功で /today へ navigate される', async () => {
    signInMock.mockResolvedValue({ ok: true, user: { id: 'u1' }, session: { user: { id: 'u1' } } });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/today' });
    });
  });

  it('submit 失敗でエラー文が表示される', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'Invalid login credentials' });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid login credentials');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: fail を確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/auth/Login.test.tsx
```

- [ ] **Step 3: 実装**

`apps/habits/src/features/auth/Login.tsx`:

```tsx
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { signIn } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { AuthForm } from './AuthForm.js';

export function Login(): React.ReactElement {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }): Promise<void> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await signIn(getAppSupabase(), values.email, values.password);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    navigate({ to: '/today' });
  };

  return (
    <section className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold text-game-accent">ログイン</h1>
      <AuthForm
        submitLabel="ログイン"
        onSubmit={(values) => {
          void handleSubmit(values);
        }}
        errorMessage={errorMessage ?? undefined}
        isSubmitting={isSubmitting}
      />
      <p className="text-sm">
        <Link to="/auth/signup" className="text-game-accent underline">
          アカウントをお持ちでない方はこちら（新規登録）
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/auth/Login.test.tsx
```

Expected: 4 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/auth/Login.tsx apps/habits/src/features/auth/Login.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): /auth/login の Login コンポーネント

AuthForm を使ってメール/パスワードで signIn。
成功時は /today へ navigate、失敗時はエラーメッセージ表示。
サインアップ画面へのリンク付き。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `Signup` コンポーネント

**目的:** `/auth/signup` の本体。Login とほぼ同じ構造で、signUp を呼び、成功で `/today` へ navigate（Email 確認 OFF の dev では即セッションが返る）。

**Files:**
- Create: `apps/habits/src/features/auth/Signup.tsx`
- Create: `apps/habits/src/features/auth/Signup.test.tsx`

- [ ] **Step 1: テスト**

`apps/habits/src/features/auth/Signup.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Signup } from './Signup.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signUp: vi.fn() } }),
}));

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});

const signUpMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signUp: (...args: unknown[]): unknown => signUpMock(...args),
}));

describe('Signup', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signUpMock.mockReset();
  });

  it('「新規登録」見出しと submit ボタンが表示される', () => {
    render(<Signup />);
    expect(screen.getByRole('heading', { name: '新規登録' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新規登録' })).toBeInTheDocument();
  });

  it('ログインへのリンクがある', () => {
    render(<Signup />);
    expect(screen.getByRole('link', { name: /既にアカウントをお持ちの方/ })).toBeInTheDocument();
  });

  it('submit 成功で /today へ navigate される', async () => {
    signUpMock.mockResolvedValue({ ok: true, user: { id: 'u1' }, session: { user: { id: 'u1' } } });
    render(<Signup />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '新規登録' }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/today' });
    });
  });

  it('submit 失敗でエラー文が表示される', async () => {
    signUpMock.mockResolvedValue({ ok: false, error: 'User already registered' });
    render(<Signup />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'dup@example.com' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '新規登録' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('User already registered');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: fail を確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/auth/Signup.test.tsx
```

- [ ] **Step 3: 実装**

`apps/habits/src/features/auth/Signup.tsx`:

```tsx
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { signUp } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { AuthForm } from './AuthForm.js';

export function Signup(): React.ReactElement {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: { email: string; password: string }): Promise<void> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await signUp(getAppSupabase(), values.email, values.password);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    navigate({ to: '/today' });
  };

  return (
    <section className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold text-game-accent">新規登録</h1>
      <AuthForm
        submitLabel="新規登録"
        onSubmit={(values) => {
          void handleSubmit(values);
        }}
        errorMessage={errorMessage ?? undefined}
        isSubmitting={isSubmitting}
      />
      <p className="text-sm">
        <Link to="/auth/login" className="text-game-accent underline">
          既にアカウントをお持ちの方はこちら（ログイン）
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/auth/Signup.test.tsx
```

Expected: 4 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/auth/Signup.tsx apps/habits/src/features/auth/Signup.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): /auth/signup の Signup コンポーネント

Login と対称の構造で signUp を呼ぶ。
Email 確認は dev で OFF のため、成功で即座に /today へ navigate される
（M2 のトリガーで初期 6 タスクが auto 生成される）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `Today` コンポーネントを別ファイルへ分離 + サインアウトボタン

**目的:** 現状 `router.tsx` 内にインライン定義されている `TodayPage` を `features/today/Today.tsx` に抽出し、ヘッダーに「ログアウト」ボタンを追加して signOut → `/auth/login` へ navigate できるようにする。M6 で実装する Today 画面の土台。

**Files:**
- Create: `apps/habits/src/features/today/Today.tsx`
- Create: `apps/habits/src/features/today/Today.test.tsx`

- [ ] **Step 1: テスト**

`apps/habits/src/features/today/Today.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Today } from './Today.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});

const signOutMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signOut: (...args: unknown[]): unknown => signOutMock(...args),
}));

describe('Today', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
  });

  it('「今日のタスク」見出しを表示する', () => {
    render(<Today />);
    expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
  });

  it('ログアウトボタンクリックで signOut → /auth/login へ navigate', async () => {
    signOutMock.mockResolvedValue({ ok: true });
    render(<Today />);
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith({ to: '/auth/login' });
    });
  });
});
```

- [ ] **Step 2: fail を確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/Today.test.tsx
```

- [ ] **Step 3: 実装**

`apps/habits/src/features/today/Today.tsx`:

```tsx
import { useNavigate } from '@tanstack/react-router';
import { signOut } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';

export function Today(): React.ReactElement {
  const navigate = useNavigate();

  const handleSignOut = async (): Promise<void> => {
    await signOut(getAppSupabase());
    navigate({ to: '/auth/login' });
  };

  return (
    <section className="p-6 space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
        <button
          type="button"
          onClick={() => {
            void handleSignOut();
          }}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          ログアウト
        </button>
      </header>
      <p className="text-sm">M6 マイルストーンで時間帯別タスクリストに置き換える。</p>
    </section>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/Today.test.tsx
```

Expected: 2 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): Today コンポーネントを独立ファイルに抽出 + ログアウトボタン

router.tsx インライン定義の TodayPage を features/today/Today.tsx に移管。
ヘッダーに「ログアウト」ボタンを追加し、signOut → /auth/login へ遷移。
M6 でタスクリスト実装時の土台。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `router.tsx` を更新（外部コンポーネント import + /auth/signup ルート + /today に AuthGate）

**目的:** Task 4/5/6 で作った Login / Signup / Today コンポーネントを router.tsx から参照し、`/today` の `beforeLoad` で未認証時に `/auth/login` へリダイレクトする。

**Files:**
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

- [ ] **Step 1: 既存テストを失敗させない形で `router.tsx` を更新**

`apps/habits/src/router.tsx` の全内容を以下に置き換える:

```tsx
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { Login } from './features/auth/Login.js';
import { Signup } from './features/auth/Signup.js';
import { Today } from './features/today/Today.js';
import { getCurrentSession } from './lib/auth.js';
import { getAppSupabase } from './lib/supabase.js';

const rootRoute = createRootRoute({
  component: () => (
    <main className="min-h-screen">
      <Outlet />
    </main>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  beforeLoad: async () => {
    const session = await getCurrentSession(getAppSupabase());
    if (session === null) {
      throw redirect({ to: '/auth/login' });
    }
  },
  component: Today,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: Login,
});

const authSignupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/signup',
  component: Signup,
});

const routeTree = rootRoute.addChildren([indexRoute, todayRoute, authLoginRoute, authSignupRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 2: 既存 `App.test.tsx` を更新（auth state を mock した上で従来 3 ケースを維持しつつ、新規 1 ケース追加）**

`apps/habits/src/App.test.tsx` の全内容を以下に置き換える:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';
import { router } from './router.js';

// supabase / auth lib を mock。未認証時は session=null、認証済セッションを返す切替が必要なテストもある。
const getCurrentSessionMock = vi.fn();
vi.mock('./lib/auth.js', () => ({
  getCurrentSession: (...args: unknown[]): unknown => getCurrentSessionMock(...args),
  signOut: vi.fn().mockResolvedValue({ ok: true }),
  signIn: vi.fn(),
  signUp: vi.fn(),
  subscribeAuthState: vi.fn().mockReturnValue(() => {}),
}));
vi.mock('./lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

async function navigate(path: string): Promise<void> {
  await router.navigate({ to: path });
}

describe('App ルーティング', () => {
  beforeEach(() => {
    getCurrentSessionMock.mockReset();
  });

  it('/auth/login で「ログイン」ページが表示される（未認証）', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/auth/login');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    });
  });

  it('/auth/signup で「新規登録」ページが表示される（未認証）', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/auth/signup');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '新規登録' })).toBeInTheDocument();
    });
  });

  it('未認証で /today にアクセスすると /auth/login へリダイレクトされる', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/today');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  it('認証済みで /today にアクセスすると「今日のタスク」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/today');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
    });
  });

  it('/ から /today（または /auth/login）へリダイレクトされる', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });
});
```

- [ ] **Step 3: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/App.test.tsx
```

Expected: 5 ケース pass。

- [ ] **Step 4: 全プロジェクト緑確認**

```bash
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
pnpm exec biome ci .
```

Expected: 全緑。

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): /auth/signup ルートを追加し /today に beforeLoad AuthGate

router.tsx を整理:
- Today / Login / Signup を features/ から import（インライン定義を撤去）
- /auth/signup ルート追加
- /today に beforeLoad: getCurrentSession() → null なら /auth/login へリダイレクト

App.test.tsx は auth lib を mock してリダイレクトケースを網羅。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: legend-state `state$.user` を Supabase auth と同期する

**目的:** アプリ起動時に `subscribeAuthState` を呼び、Supabase の onAuthStateChange イベントを `state$.user` に反映する。これで M5 以降の同期層がユーザー ID を参照できる。

**Files:**
- Modify: `packages/habit-sync/src/observables.ts`（user の型を Supabase の User に合わせる）
- Modify: `packages/habit-sync/src/index.ts`（User 型を re-export）
- Create: `apps/habits/src/hooks/useAuthSession.ts`
- Create: `apps/habits/src/hooks/useAuthSession.test.tsx`
- Modify: `apps/habits/src/App.tsx`（useAuthSession を呼ぶ）

- [ ] **Step 1: `packages/habit-sync/src/observables.ts` を更新**

```ts
import { observable } from '@legendapp/state';
import type { User } from '@supabase/supabase-js';

// 同期 observable の root。
// M5 で syncedSupabase / IndexedDB 永続化を追加する。
// 現時点では型骨格のみで、実体は空オブジェクト。
export const state$ = observable({
  user: null as User | null,
  time_slots: {} as Record<string, unknown>,
  tasks: {} as Record<string, unknown>,
  task_logs: {} as Record<string, unknown>,
});

export type SyncState = typeof state$;
```

- [ ] **Step 2: `packages/habit-sync/src/index.ts` の末尾に User 型 re-export を追加**

`packages/habit-sync/src/index.ts` の現在の内容（M2 で追記済）を確認し、末尾に以下を追加:

```ts
export type { User, Session } from '@supabase/supabase-js';
```

- [ ] **Step 3: habit-sync の既存テストが緑のまま通ることを確認**

```bash
CI=true pnpm nx test @org/habit-sync
```

Expected: 4 件 pass（state$.user.set の型が User | null に変わったが、既存テストは `null` と `{ id, email }` を渡しており、User 互換のため通る）。

> **注:** もし既存テスト `state$.user.set({ id: 'u1', email: 'a@b.co' })` が type 不一致で fail する場合、`as unknown as User` でキャストするか、テスト側で `{ id: 'u1', email: 'a@b.co' } as User` に変更する。

- [ ] **Step 4: `apps/habits/src/hooks/useAuthSession.test.tsx` 作成**

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { state$ } from '@org/habit-sync';
import { useAuthSession } from './useAuthSession.js';

const getCurrentSessionMock = vi.fn();
const subscribeAuthStateMock = vi.fn();
vi.mock('../lib/auth.js', () => ({
  getCurrentSession: (...args: unknown[]): unknown => getCurrentSessionMock(...args),
  subscribeAuthState: (...args: unknown[]): unknown => subscribeAuthStateMock(...args),
}));
vi.mock('../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

describe('useAuthSession', () => {
  beforeEach(() => {
    state$.user.set(null);
    getCurrentSessionMock.mockReset();
    subscribeAuthStateMock.mockReset();
    subscribeAuthStateMock.mockReturnValue(() => {});
  });

  it('マウント時に getCurrentSession を呼んで state$.user に反映する', async () => {
    const session: Session = { user: { id: 'u1', email: 'a@b.co' }, access_token: 'x' } as Session;
    getCurrentSessionMock.mockResolvedValue(session);
    renderHook(() => useAuthSession());
    // 非同期反映を待つ
    await vi.waitFor(() => {
      expect(state$.user.get()?.id).toBe('u1');
    });
  });

  it('subscribeAuthState のコールバックで state$.user を更新する', () => {
    let listener: ((event: string, session: Session | null) => void) | null = null;
    subscribeAuthStateMock.mockImplementation((_client, l) => {
      listener = l;
      return () => {};
    });
    getCurrentSessionMock.mockResolvedValue(null);
    renderHook(() => useAuthSession());
    expect(listener).not.toBeNull();
    listener?.('SIGNED_IN', { user: { id: 'u2', email: 'c@d.co' }, access_token: 'y' } as Session);
    expect(state$.user.get()?.id).toBe('u2');
    listener?.('SIGNED_OUT', null);
    expect(state$.user.get()).toBeNull();
  });

  it('unmount で unsubscribe される', () => {
    const unsub = vi.fn();
    subscribeAuthStateMock.mockReturnValue(unsub);
    getCurrentSessionMock.mockResolvedValue(null);
    const { unmount } = renderHook(() => useAuthSession());
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: `apps/habits/src/hooks/useAuthSession.ts` を実装**

```ts
import { state$ } from '@org/habit-sync';
import { useEffect } from 'react';
import { getCurrentSession, subscribeAuthState } from '../lib/auth.js';
import { getAppSupabase } from '../lib/supabase.js';

// アプリ起動時にセッション復元 + onAuthStateChange の購読を行うフック。
// App.tsx で 1 回だけ呼ぶ想定。
export function useAuthSession(): void {
  useEffect(() => {
    const client = getAppSupabase();

    // 初期セッション取得（localStorage からの復元含む）
    void getCurrentSession(client).then((session) => {
      state$.user.set(session?.user ?? null);
    });

    // 後続のサインイン/アウト/トークン更新を購読
    const unsub = subscribeAuthState(client, (_event, session) => {
      state$.user.set(session?.user ?? null);
    });

    return () => {
      unsub();
    };
  }, []);
}
```

- [ ] **Step 6: `apps/habits/src/App.tsx` で useAuthSession を呼ぶ**

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { useAuthSession } from './hooks/useAuthSession.js';
import { router } from './router.js';

export default function App(): React.ReactElement {
  useAuthSession();
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 7: テスト全体検証 + コミット**

```bash
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
pnpm exec biome ci .
```

Expected: 全プロジェクト緑、auth.test (6) + supabase.test (3) + AuthForm.test (7) + Login.test (4) + Signup.test (4) + Today.test (2) + useAuthSession.test (3) + App.test (5) = 34 件 + habit-sync (4) + habit-core (5) = 43 件のテストが通る。

```bash
git add packages/habit-sync/src/observables.ts packages/habit-sync/src/index.ts apps/habits/src/hooks/useAuthSession.ts apps/habits/src/hooks/useAuthSession.test.tsx apps/habits/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(habits): useAuthSession で legend-state user を Supabase auth に同期

state$.user の型を Supabase の User | null に変更し、
useAuthSession フックでアプリ起動時にセッション復元 + onAuthStateChange を購読。
App.tsx で 1 回だけ呼ぶ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 手動 E2E 検証 + ドキュメント更新

**目的:** ローカル Supabase + dev サーバーで実際に signup → /today 表示 → signOut → /auth/login → signIn → /today の往復が動くことを確認する。

**Files:**
- Modify: `CLAUDE.md`（M3 の運用注意を追記）

### 検証手順

- [ ] **Step 1: 環境準備**

```bash
# .env.local が存在することを確認
ls apps/habits/.env.local
# 無ければ .env.local.example をコピーして supabase start の anon key を貼る
```

```bash
supabase start
supabase db reset  # クリーンな DB から始める
```

- [ ] **Step 2: dev server 起動**

```bash
pnpm nx serve habits
```

別ターミナルで `psql` を開いておくと検証が楽:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres"
```

- [ ] **Step 3: 新規ユーザーで signup**

ブラウザで `http://localhost:5173/auth/signup` を開く。

- メール: `test+m3@example.com`
- パスワード: `password123`

「新規登録」を押す。Expected:
- `/today` に遷移し、「今日のタスク」見出しと「ログアウト」ボタンが表示される

psql で確認:

```sql
SELECT email, id FROM auth.users WHERE email = 'test+m3@example.com';
SELECT name, frequency->>'type' FROM tasks WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test+m3@example.com') ORDER BY time_slot_id, sort_order;
```

Expected: tasks が 6 件返る（朝 4 + 夜 2、M2 トリガーの効果）。

- [ ] **Step 4: ログアウト → 再ログイン**

ブラウザで「ログアウト」を押す。Expected: `/auth/login` に遷移。

メール / パスワードを再入力して「ログイン」を押す。Expected: `/today` に遷移。

- [ ] **Step 5: 直接 /today にアクセスして AuthGate が機能することを確認**

ブラウザの localStorage から `sb-localhost-auth-token` を削除（DevTools → Application → Storage → Local Storage）。

ブラウザで `http://localhost:5173/today` を直接開く。Expected: `/auth/login` にリダイレクトされる。

- [ ] **Step 6: CLAUDE.md に M3 メモを追記**

`/Users/ikomiki/workspace/daily-task/CLAUDE.md` の `## Supabase ローカル開発` セクションの最後（` ``` ` ブロックの後）に以下を追記:

```markdown

### 認証フロー（M3 以降）

- ローカル `.env.local` の `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を `supabase start` 出力から転記
- `/auth/signup` で新規登録 → Email 確認は dev で OFF のため即セッション → `/today` 着地
- 初期データ（6 タスク + 2 時間帯）は `auth.users` INSERT トリガーで自動生成
- セッションは localStorage に保存され、onAuthStateChange で `state$.user` に反映される
- 未認証で `/today` にアクセスすると `/auth/login` にリダイレクト
```

- [ ] **Step 7: コミット**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: CLAUDE.md に M3 認証フローの運用メモを追記

.env.local の設定、サインアップ→初期データ→/today 着地、AuthGate の動作
について簡潔にメモ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 次のマイルストーン

このプラン完了後、次は **M4: ドメインロジック** の実装プランを `docs/superpowers/plans/2026-05-16-habits-app-m4-domain.md` として作成する。M4 で扱う内容:

- `packages/habit-core/src/frequency.ts` の `isDueOn` を M1 雛形（throw）から実装に置き換え（5 type すべて、SQL の `is_due_on` と同等のロジック）
- 月末・第 5 週・閏年・年跨ぎ等のエッジケースをテーブル駆動テストで網羅
- `packages/habit-core/src/streak.ts` の `calculateStreak` を実装（spec §5.3 のルール: complete=+1, skip=維持, fail=リセット）
- SQL の `is_due_on` 関数の出力との一致を検証するクロスバリデーションテスト（任意、`supabase db reset` 経由で psql 比較）
