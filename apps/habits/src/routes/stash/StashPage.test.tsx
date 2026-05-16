import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StashPage } from './StashPage.js';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

vi.mock('../../features/stash/StashPanel.js', () => ({
  StashPanel: () => <div data-testid="stash-panel" />,
}));

describe('StashPage', () => {
  it('「スタッシュ」見出しを表示する', () => {
    render(<StashPage />);
    expect(screen.getByRole('heading', { name: 'スタッシュ' })).toBeInTheDocument();
  });

  it('今日のタスクへ戻るリンクを表示する', () => {
    render(<StashPage />);
    const link = screen.getByRole('link', { name: '今日のタスク' });
    expect(link).toHaveAttribute('href', '/today');
  });

  it('StashPanel を描画する', () => {
    render(<StashPage />);
    expect(screen.getByTestId('stash-panel')).toBeInTheDocument();
  });
});
