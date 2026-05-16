import { RouterProvider } from '@tanstack/react-router';
import { useAuthSession } from './hooks/useAuthSession.js';
import { useSyncBootstrap } from './hooks/useSyncBootstrap.js';
import { router } from './router.js';

export default function App(): React.ReactElement {
  useAuthSession();
  useSyncBootstrap();
  return <RouterProvider router={router} />;
}
