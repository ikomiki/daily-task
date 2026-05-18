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

  it('オフラインのとき「オフラインです」と「同期されます」を表示する', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByText(/オフラインです/)).toBeInTheDocument();
    expect(screen.getByText(/同期されます/)).toBeInTheDocument();
  });

  it('role=status を持つ（スクリーンリーダー対応）', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
