import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreHud } from './ScoreHud';

describe('ScoreHud', () => {
  it('スコアを表示する', () => {
    render(<ScoreHud score={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('ラベル "Score" を表示する', () => {
    render(<ScoreHud score={0} />);
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('aria-label でアクセシブル', () => {
    render(<ScoreHud score={7} />);
    expect(screen.getByRole('status', { name: /score/i })).toBeInTheDocument();
  });
});
