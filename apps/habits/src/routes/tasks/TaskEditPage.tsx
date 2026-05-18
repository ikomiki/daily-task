import { use$ } from '@legendapp/state/react';
import type { Frequency } from '@org/habit-core';
import { archiveTask, state$, updateTask } from '@org/habit-sync';
import { Button, PageContainer, PageHeader } from '@org/ui';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
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
      <PageContainer>
        <p className="text-sm text-red-400">タスクが見つかりません。</p>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </PageContainer>
    );
  }

  const task = result.task;

  return (
    <PageContainer>
      <PageHeader
        title="タスクの編集"
        right={
          <Link to="/tasks" className="text-sm text-game-accent underline">
            ← 一覧へ戻る
          </Link>
        }
      />
      <RoutedAppNav />
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
      <Button
        variant="destructive"
        onClick={() => {
          archiveTask(id);
          void navigate({ to: '/tasks' });
        }}
      >
        このタスクをアーカイブ
      </Button>
    </PageContainer>
  );
}
