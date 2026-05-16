import { Link } from '@tanstack/react-router';
import { TimeSlotList } from '../../features/timeslot/TimeSlotList.js';

export function SettingsTimeSlotsPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">時間帯の設定</h1>
        <Link to="/today" className="text-sm text-game-accent underline">
          ← 今日のタスク
        </Link>
      </header>
      <TimeSlotList />
    </section>
  );
}
