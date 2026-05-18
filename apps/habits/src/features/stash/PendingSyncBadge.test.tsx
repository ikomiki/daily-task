import { online$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PendingSyncBadge } from './PendingSyncBadge.js';

beforeEach(() => {
  online$.set(true);
});
afterEach(() => {
  online$.set(true);
});

describe('PendingSyncBadge', () => {
  it('オンラインのとき何も描画しない', () => {
    const { container } = render(<PendingSyncBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('オフラインのとき「オフライン」と「古い可能性」を表示する', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByText(/オフライン/)).toBeInTheDocument();
    expect(screen.getByText(/古い可能性/)).toBeInTheDocument();
  });

  it('role=status を持つ（スクリーンリーダー対応）', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
