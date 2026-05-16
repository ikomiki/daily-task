import { state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsTimeSlotsPage } from './SettingsTimeSlotsPage.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
  };
});

describe('SettingsTimeSlotsPage', () => {
  beforeEach(() => {
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('「時間帯の設定」見出しを表示する', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('heading', { name: '時間帯の設定' })).toBeInTheDocument();
  });

  it('「今日のタスク」リンクがある', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('link', { name: /今日のタスク/ })).toBeInTheDocument();
  });

  it('TimeSlotList の「時間帯を追加」ボタンが見える', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('button', { name: /時間帯を追加/ })).toBeInTheDocument();
  });

  it('通知設定リンクが表示される', () => {
    render(<SettingsTimeSlotsPage />);
    const link = screen.getByRole('link', { name: '通知設定' });
    expect(link).toHaveAttribute('href', '/settings/notifications');
  });
});
