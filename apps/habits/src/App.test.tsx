import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.js';

describe('App プレースホルダ', () => {
  it('Habits タイトルを表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Habits' })).toBeInTheDocument();
  });

  it('M1 スキャフォールドの説明文を表示する', () => {
    render(<App />);
    expect(screen.getByText(/M1 スキャフォールド完了/)).toBeInTheDocument();
  });
});
