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
    return {
      ok: false,
      error:
        'サインアップは成功しましたが、セッションが取得できませんでした（Email 確認が有効？）。',
    };
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

export async function signOut(client: SupabaseClient): Promise<AuthResult<object>> {
  const { error } = await client.auth.signOut();
  if (error !== null) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// 起動時にセッションを取得し、変化を観測するヘルパー。
// onAuthStateChange は { data: { subscription } } を返すため、unsubscribe 関数を返す。
export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

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
