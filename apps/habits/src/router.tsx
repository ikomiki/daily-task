import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { Login } from './features/auth/Login.js';
import { Signup } from './features/auth/Signup.js';
import { Today } from './features/today/Today.js';
import { getCurrentSession } from './lib/auth.js';
import { getAppSupabase } from './lib/supabase.js';

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
  beforeLoad: async () => {
    const session = await getCurrentSession(getAppSupabase());
    if (session === null) {
      throw redirect({ to: '/auth/login' });
    }
  },
  component: Today,
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

const routeTree = rootRoute.addChildren([indexRoute, todayRoute, authLoginRoute, authSignupRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
