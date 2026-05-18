import { Link } from '@tanstack/react-router';
import type React from 'react';
import { CalendarView } from '../../features/calendar/CalendarView.js';

export function CalendarPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">カレンダー</h1>
        <nav className="flex items-center gap-2">
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <CalendarView />
    </section>
  );
}
