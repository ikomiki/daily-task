import { use$ } from '@legendapp/state/react';
import type { Frequency } from '@org/habit-core';
import { archiveTask, state$, updateTask } from '@org/habit-sync';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { TaskForm } from '../../features/task/TaskForm.js';

export function TaskEditPage(): React.ReactElement {
  const { id } = useParams({ from: '/tasks/$id' });
  const navigate = useNavigate();

  const result = use$(() => {
    const task = state$.tasks.get()[id];
    const slots = Object.values(state$.time_slots.get()).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return { task, slots };
  });

  if (result.task === undefined) {
    return (
      <section className="mx-auto max-w-2xl p-6 space-y-4">
        <p className="text-sm text-red-400">タスクが見つかりません。</p>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </section>
    );
  }

  const task = result.task;

  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">タスクの編集</h1>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </header>
      <TaskForm
        timeSlots={result.slots}
        initial={{
          name: task.name,
          time_slot_id: task.time_slot_id,
          frequency: task.frequency as unknown as Frequency,
        }}
        submitLabel="保存"
        onSubmit={(values) => {
          updateTask(id, values);
          void navigate({ to: '/tasks' });
        }}
      />
      <button
        type="button"
        onClick={() => {
          archiveTask(id);
          void navigate({ to: '/tasks' });
        }}
        className="rounded border border-red-500 px-3 py-1 text-sm text-red-400"
      >
        このタスクをアーカイブ
      </button>
    </section>
  );
}
