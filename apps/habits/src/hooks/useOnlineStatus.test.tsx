import { online$ } from '@org/habit-sync';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus.js';

function Probe(): React.ReactElement {
  const online = useOnlineStatus();
  return <span data-testid="online">{online ? 'online' : 'offline'}</span>;
}

describe('useOnlineStatus', () => {
  beforeEach(() => {
    online$.set(true);
  });
  afterEach(() => {
    online$.set(true);
  });

  it('online$ の値を返す', () => {
    render(<Probe />);
    expect(screen.getByTestId('online')).toHaveTextContent('online');
  });

  it('online$ が false になると offline を返す', () => {
    render(<Probe />);
    act(() => {
      online$.set(false);
    });
    expect(screen.getByTestId('online')).toHaveTextContent('offline');
  });
});
