import { online$, state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PendingSyncBadge } from './PendingSyncBadge.js';

let mockedCount = 0;

vi.mock('../../hooks/usePendingSyncCount.js', () => ({
  usePendingSyncCount: (): number => mockedCount,
}));

beforeEach(() => {
  mockedCount = 0;
  online$.set(true);
  state$.tasks.set({});
});
afterEach(() => {
  mockedCount = 0;
  online$.set(true);
  state$.tasks.set({});
});

describe('PendingSyncBadge', () => {
  it('オンライン & 未同期 0 件のとき何も描画しない', () => {
    const { container } = render(<PendingSyncBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('オフラインのとき「オフライン」を表示する', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByText(/オフライン/)).toBeInTheDocument();
  });

  it('未同期 1 件以上のとき「同期前 N 件」を表示する', () => {
    mockedCount = 3;
    render(<PendingSyncBadge />);
    expect(screen.getByText(/同期前\s*3\s*件/)).toBeInTheDocument();
  });

  it('オフライン + 未同期 2 件のとき両方を表示する', () => {
    online$.set(false);
    mockedCount = 2;
    render(<PendingSyncBadge />);
    expect(screen.getByText(/オフライン/)).toBeInTheDocument();
    expect(screen.getByText(/同期前\s*2\s*件/)).toBeInTheDocument();
  });

  it('role=status を持つ（スクリーンリーダー対応）', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
