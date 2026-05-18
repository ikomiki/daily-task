import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/history' } }),
}));

vi.mock('../../features/history/HistoryView.js', () => ({
  HistoryView: () => <div data-testid="history-view" />,
}));
vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../../lib/auth.js', () => ({
  signOut: vi.fn(),
}));

import { HistoryPage } from './HistoryPage.js';

describe('HistoryPage', () => {
  it('「履歴」見出しを表示する', () => {
    render(<HistoryPage />);
    expect(screen.getByRole('heading', { name: '履歴' })).toBeInTheDocument();
  });

  it('今日リンクを表示する', () => {
    render(<HistoryPage />);
    const link = screen.getByRole('link', { name: '今日' });
    expect(link).toHaveAttribute('href', '/today');
  });

  it('HistoryView を描画する', () => {
    render(<HistoryPage />);
    expect(screen.getByTestId('history-view')).toBeInTheDocument();
  });
});
