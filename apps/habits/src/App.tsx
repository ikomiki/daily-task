import { RouterProvider } from '@tanstack/react-router';
import { useAuthSession } from './hooks/useAuthSession.js';
import { router } from './router.js';

export default function App(): React.ReactElement {
  useAuthSession();
  return <RouterProvider router={router} />;
}
