import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

vi.mock('../../features/history/HistoryView.js', () => ({
  HistoryView: () => <div data-testid="history-view" />,
}));

import { HistoryPage } from './HistoryPage.js';

describe('HistoryPage', () => {
  it('「履歴」見出しを表示する', () => {
    render(<HistoryPage />);
    expect(screen.getByRole('heading', { name: '履歴' })).toBeInTheDocument();
  });

  it('今日のタスクへ戻るリンクを表示する', () => {
    render(<HistoryPage />);
    const link = screen.getByRole('link', { name: '今日のタスク' });
    expect(link).toHaveAttribute('href', '/today');
  });

  it('HistoryView を描画する', () => {
    render(<HistoryPage />);
    expect(screen.getByTestId('history-view')).toBeInTheDocument();
  });
});
