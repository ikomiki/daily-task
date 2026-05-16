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
