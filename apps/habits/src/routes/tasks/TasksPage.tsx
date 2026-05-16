import { Link, useNavigate } from '@tanstack/react-router';
import { TaskList } from '../../features/task/TaskList.js';

export function TasksPage(): React.ReactElement {
  const navigate = useNavigate();
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">タスク管理</h1>
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
      </header>
      <TaskList
        onEdit={(id) => {
          void navigate({ to: '/tasks/$id', params: { id } });
        }}
      />
    </section>
  );
}
