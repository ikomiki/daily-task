import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StashPage } from './StashPage.js';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/stash' } }),
}));

vi.mock('../../features/stash/StashPanel.js', () => ({
  // StashPanel は PageHeader（スタッシュ見出し）を内包するため、見出しも一緒に出力する
  StashPanel: () => (
    <>
      <h1>スタッシュ</h1>
      <div data-testid="stash-panel" />
    </>
  ),
}));
vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../../lib/auth.js', () => ({
  signOut: vi.fn(),
}));

describe('StashPage', () => {
  it('「スタッシュ」見出しを表示する', () => {
    render(<StashPage />);
    expect(screen.getByRole('heading', { name: 'スタッシュ' })).toBeInTheDocument();
  });

  it('今日リンクを表示する', () => {
    render(<StashPage />);
    const link = screen.getByRole('link', { name: '今日' });
    expect(link).toHaveAttribute('href', '/today');
  });

  it('StashPanel を描画する', () => {
    render(<StashPage />);
    expect(screen.getByTestId('stash-panel')).toBeInTheDocument();
  });
});
