import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));
vi.mock('../../features/calendar/CalendarView.js', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}));

import { CalendarPage } from './CalendarPage.js';

describe('CalendarPage', () => {
  it('「カレンダー」見出しを表示する', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('heading', { name: 'カレンダー' })).toBeInTheDocument();
  });
  it('今日のタスクへ戻るリンク', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('link', { name: '今日のタスク' })).toHaveAttribute('href', '/today');
  });
  it('CalendarView を描画', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });
});
