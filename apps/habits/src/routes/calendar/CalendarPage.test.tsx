import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/calendar' } }),
}));
vi.mock('../../features/calendar/CalendarView.js', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}));
vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../../lib/auth.js', () => ({
  signOut: vi.fn(),
}));

import { CalendarPage } from './CalendarPage.js';

describe('CalendarPage', () => {
  it('「カレンダー」見出しを表示する', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('heading', { name: 'カレンダー' })).toBeInTheDocument();
  });
  it('今日リンクがある', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('link', { name: '今日' })).toHaveAttribute('href', '/today');
  });
  it('CalendarView を描画', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });
});
