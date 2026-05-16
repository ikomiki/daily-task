import { use$ } from '@legendapp/state/react';
import { createTask, state$ } from '@org/habit-sync';
import { Link, useNavigate } from '@tanstack/react-router';
import { TaskForm } from '../../features/task/TaskForm.js';

export function TaskNewPage(): React.ReactElement {
  const navigate = useNavigate();
  const timeSlots = use$(() => {
    const slots = Object.values(state$.time_slots.get());
    return [...slots].sort((a, b) => a.sort_order - b.sort_order);
  });

  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">新規タスク</h1>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </header>
      <TaskForm
        timeSlots={timeSlots}
        submitLabel="作成"
        onSubmit={(values) => {
          const sameSlotMax = Math.max(
            -1,
            ...Object.values(state$.tasks.get())
              .filter((t) => t.time_slot_id === values.time_slot_id)
              .map((t) => t.sort_order),
          );
          createTask({ ...values, sort_order: sameSlotMax + 1 });
          void navigate({ to: '/tasks' });
        }}
      />
    </section>
  );
}
