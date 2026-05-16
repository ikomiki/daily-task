import { Link, useNavigate } from '@tanstack/react-router';
import { signOut } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { TodayView } from './TodayView.js';

export function Today(): React.ReactElement {
  const navigate = useNavigate();
  const today = getTodayDateString();

  const handleSignOut = async (): Promise<void> => {
    await signOut(getAppSupabase());
    navigate({ to: '/auth/login' });
  };

  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
        <nav className="flex items-center gap-2">
          <Link to="/tasks" className="rounded border border-gray-500 px-3 py-1 text-sm">
            タスク管理
          </Link>
          <Link to="/stash" className="rounded border border-gray-500 px-3 py-1 text-sm">
            スタッシュ
          </Link>
          <Link to="/history" className="rounded border border-gray-500 px-3 py-1 text-sm">
            履歴
          </Link>
          <Link
            to="/settings/time-slots"
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            設定
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            ログアウト
          </button>
        </nav>
      </header>
      <TodayView today={today} />
    </section>
  );
}
