import { use$ } from '@legendapp/state/react';
import { createTask, state$ } from '@org/habit-sync';
import { PageContainer, PageHeader } from '@org/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { TaskForm } from '../../features/task/TaskForm.js';

export function TaskNewPage(): React.ReactElement {
  const navigate = useNavigate();
  const timeSlots = use$(() => {
    const slots = Object.values(state$.time_slots.get());
    return [...slots].sort((a, b) => a.sort_order - b.sort_order);
  });

  return (
    <PageContainer>
      <PageHeader
        title="新規タスク"
        right={
          <Link to="/tasks" className="text-sm text-game-accent underline">
            ← 一覧へ戻る
          </Link>
        }
      />
      <RoutedAppNav />
      <TaskForm
        timeSlots={timeSlots}
        submitLabel="作成"
        onCancel={() => void navigate({ to: '/tasks' })}
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
    </PageContainer>
  );
}
