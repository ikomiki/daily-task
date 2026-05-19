import { WebNotificationProvider } from '@org/habit-sync';
import type { LinkComponentProps } from '@org/ui';
import { TopBar } from '@org/ui';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from '@tanstack/react-router';
import type React from 'react';
import { Login } from './features/auth/Login.js';
import { Signup } from './features/auth/Signup.js';
import { NotificationManager } from './features/notify/NotificationManager.js';
import { Today } from './features/today/Today.js';
import { getCurrentSession } from './lib/auth.js';
import { getAppSupabase } from './lib/supabase.js';
import { getTodayDateString } from './lib/today-date.js';
import { CalendarPage } from './routes/calendar/CalendarPage.js';
import { HistoryPage } from './routes/history/HistoryPage.js';
import { SettingsNotificationsPage } from './routes/settings/SettingsNotificationsPage.js';
import { SettingsTimeSlotsPage } from './routes/settings/SettingsTimeSlotsPage.js';
import { StashPage } from './routes/stash/StashPage.js';
import { TaskEditPage } from './routes/tasks/TaskEditPage.js';
import { TaskNewPage } from './routes/tasks/TaskNewPage.js';
import { TasksPage } from './routes/tasks/TasksPage.js';

// モジュールレベルで provider を生成（アプリ全体で 1 インスタンス共有）
const notificationProvider = new WebNotificationProvider();

/** ルートレイアウト。認証画面以外では TopBar を表示する。 */
function RootComponent(): React.ReactElement {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuth = pathname.startsWith('/auth');
  return (
    <div className="flex min-h-screen flex-col">
      <NotificationManager provider={notificationProvider} today={getTodayDateString()} />
      {!isAuth && (
        <TopBar linkComponent={Link as unknown as React.ComponentType<LinkComponentProps>} />
      )}
      <Outlet />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
});

// 認証必須ルート用の共通 beforeLoad
async function requireAuth(): Promise<void> {
  const session = await getCurrentSession(getAppSupabase());
  if (session === null) {
    throw redirect({ to: '/auth/login' });
  }
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  beforeLoad: requireAuth,
  component: Today,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  beforeLoad: requireAuth,
  component: TasksPage,
});

const taskNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/new',
  beforeLoad: requireAuth,
  component: TaskNewPage,
});

const taskEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/$id',
  beforeLoad: requireAuth,
  component: TaskEditPage,
});

const settingsTimeSlotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/time-slots',
  beforeLoad: requireAuth,
  component: SettingsTimeSlotsPage,
});

const settingsNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/notifications',
  beforeLoad: requireAuth,
  component: SettingsNotificationsPage,
});

const stashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stash',
  beforeLoad: requireAuth,
  component: StashPage,
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  beforeLoad: requireAuth,
  component: CalendarPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  beforeLoad: requireAuth,
  component: HistoryPage,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: Login,
});

const authSignupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/signup',
  component: Signup,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  tasksRoute,
  taskNewRoute,
  taskEditRoute,
  settingsTimeSlotsRoute,
  settingsNotificationsRoute,
  stashRoute,
  calendarRoute,
  historyRoute,
  authLoginRoute,
  authSignupRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
