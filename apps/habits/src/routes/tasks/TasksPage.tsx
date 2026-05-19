import { PageContainer, PageHeader } from '@org/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { RoutedAppNav } from '../../components/RoutedAppNav.js';
import { TaskList } from '../../features/task/TaskList.js';

export function TasksPage(): React.ReactElement {
  const navigate = useNavigate();
  return (
    <PageContainer>
      <PageHeader
        title="タスク管理"
        right={
          <Link
            to="/tasks/new"
            className="inline-flex items-center gap-1 rounded-md bg-game-accent px-3.5 py-1.5 text-sm font-semibold text-game-bg transition-colors hover:bg-game-accent/90"
          >
            <span aria-hidden="true">＋</span> 新規追加
          </Link>
        }
      />
      <RoutedAppNav />
      <TaskList
        onEdit={(id) => {
          void navigate({ to: '/tasks/$id', params: { id } });
        }}
      />
    </PageContainer>
  );
}
