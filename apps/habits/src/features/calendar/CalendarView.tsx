import { use$ } from '@legendapp/state/react';
import { state$, type Task } from '@org/habit-sync';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useTaskCalendar } from '../../hooks/useTaskCalendar.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { CalendarGrid } from './CalendarGrid.js';
import { CalendarHeader } from './CalendarHeader.js';

function useAllTasksForCalendar(): Task[] {
  return use$(() => {
    const list = Object.values(state$.tasks.get()) as Task[];
    return list.filter((t) => t.archived_at === null).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function CalendarView(): React.ReactElement {
  const tasks = useAllTasksForCalendar();
  const today = getTodayDateString();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId === null && tasks.length > 0) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const { yearMonth, cells, goPrevMonth, goNextMonth, toggleCell } = useTaskCalendar(
    selectedId,
    today,
  );

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        タスクが登録されていません。先にタスクを追加してください。
      </p>
    );
  }

  const isAtCurrentMonth = yearMonth === today.slice(0, 7);

  return (
    <div className="space-y-4">
      <CalendarHeader
        tasks={tasks}
        selectedId={selectedId}
        onSelectTask={setSelectedId}
        yearMonth={yearMonth}
        isAtCurrentMonth={isAtCurrentMonth}
        onPrevMonth={goPrevMonth}
        onNextMonth={goNextMonth}
      />
      <CalendarGrid
        cells={cells}
        onCellClick={(d) => {
          void toggleCell(d);
        }}
      />
    </div>
  );
}
