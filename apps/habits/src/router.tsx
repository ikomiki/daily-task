import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';

const rootRoute = createRootRoute({
  component: () => (
    <main className="min-h-screen">
      <Outlet />
    </main>
  ),
});

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
  component: TodayPage,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([indexRoute, todayRoute, authLoginRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// M6 マイルストーンで実コンポーネントに置き換える。
function TodayPage(): React.ReactElement {
  return (
    <section className="p-6 space-y-3">
      <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
      <p className="text-sm">M6 マイルストーンで時間帯別タスクリストに置き換える。</p>
    </section>
  );
}

// M3 マイルストーンで実コンポーネントに置き換える。
function LoginPage(): React.ReactElement {
  return (
    <section className="p-6 space-y-3 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-game-accent">ログイン</h1>
      <p className="text-sm">
        M3 マイルストーンで Supabase Email/Password 認証フォームを実装する。
      </p>
    </section>
  );
}
