import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('use-sound', () => ({
  default: () => [vi.fn(), { stop: vi.fn() }],
}));

vi.mock('@pixi/react', () => ({
  Application: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="pixi-app">{children}</div>
  ),
  extend: () => undefined,
}));

describe('App (sample-game)', () => {
  it('初期スコア 0 を表示する', () => {
    render(<App />);
    expect(screen.getByRole('status', { name: /score/i })).toHaveTextContent('0');
  });

  it('スプライトボタンをクリックするとスコアが +1 される', async () => {
    const user = userEvent.setup();
    render(<App />);
    const sprite = screen.getByRole('button', { name: /tap/i });
    await user.click(sprite);
    expect(screen.getByRole('status', { name: /score/i })).toHaveTextContent('1');
  });
});
