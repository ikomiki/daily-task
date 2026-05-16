import { Link } from '@tanstack/react-router';
import { TimeSlotList } from '../../features/timeslot/TimeSlotList.js';

export function SettingsTimeSlotsPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">時間帯の設定</h1>
        <nav className="flex items-center gap-2">
          <Link
            to="/settings/notifications"
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            通知設定
          </Link>
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <TimeSlotList />
    </section>
  );
}
