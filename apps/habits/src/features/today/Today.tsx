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
