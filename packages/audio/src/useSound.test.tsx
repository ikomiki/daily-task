import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSound } from './useSound';

vi.mock('use-sound', () => ({
  default: () => [vi.fn(), { stop: vi.fn() }],
}));

describe('useGameSound', () => {
  it('play 関数を返す', () => {
    const { result } = renderHook(() => useGameSound('/se/click.mp3'));
    expect(typeof result.current.play).toBe('function');
  });

  it('stop 関数を返す', () => {
    const { result } = renderHook(() => useGameSound('/se/click.mp3'));
    expect(typeof result.current.stop).toBe('function');
  });
});
