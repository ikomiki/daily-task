import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AlertText } from './AlertText.js';

describe('AlertText', () => {
  it('子テキストをレンダリングする', () => {
    render(<AlertText>エラーメッセージ</AlertText>);
    expect(screen.getByText('エラーメッセージ')).toBeDefined();
  });

  it('デフォルト（error）は role="alert" が付与される', () => {
    render(<AlertText>エラー</AlertText>);
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('tone="error" は role="alert" が付与される', () => {
    render(<AlertText tone="error">エラー</AlertText>);
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('tone="warning" は role="status" が付与される', () => {
    render(<AlertText tone="warning">警告</AlertText>);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('error トーンに text-red-300 クラスが適用される', () => {
    render(<AlertText tone="error">エラー</AlertText>);
    const el = screen.getByRole('alert');
    expect(el.className).toContain('text-red-300');
  });

  it('warning トーンに text-yellow-300 クラスが適用される', () => {
    render(<AlertText tone="warning">警告</AlertText>);
    const el = screen.getByRole('status');
    expect(el.className).toContain('text-yellow-300');
  });
});
