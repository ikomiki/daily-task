import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.js';
import { router } from './router.js';

async function navigate(path: string): Promise<void> {
  await router.navigate({ to: path });
}

describe('App ルーティング', () => {
  it('/today で「今日のタスク」ページが表示される', async () => {
    await navigate('/today');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
    });
  });

  it('/auth/login で「ログイン」ページが表示される', async () => {
    await navigate('/auth/login');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    });
  });

  it('/ から /today へリダイレクトされる', async () => {
    await navigate('/');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/today');
    });
  });
});
