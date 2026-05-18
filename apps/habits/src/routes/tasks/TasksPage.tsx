import { PageContainer, PageHeader } from '@org/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { TaskList } from '../../features/task/TaskList.js';

export function TasksPage(): React.ReactElement {
  const navigate = useNavigate();
  return (
    <PageContainer>
      <PageHeader
        title="タスク管理"
        right={
          <div className="flex items-center gap-2">
            <Link to="/today" className="text-sm text-game-accent underline">
              ← 今日のタスク
            </Link>
            <Link
              to="/tasks/new"
              className="rounded bg-game-accent px-3 py-1 text-sm font-medium text-game-bg"
            >
              新規追加
            </Link>
          </div>
        }
      />
      <TaskList
        onEdit={(id) => {
          void navigate({ to: '/tasks/$id', params: { id } });
        }}
      />
    </PageContainer>
  );
}
