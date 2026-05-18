import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader.js';

describe('PageHeader', () => {
  it('タイトルをレンダリングする', () => {
    render(<PageHeader title="テストタイトル" />);
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByText('テストタイトル')).toBeDefined();
  });

  it('nav スロットが渡された場合にレンダリングする', () => {
    render(<PageHeader title="タイトル" nav={<span>ナビゲーション</span>} />);
    expect(screen.getByText('ナビゲーション')).toBeDefined();
  });

  it('nav が未指定の場合はナビゲーション要素を出さない', () => {
    const { container } = render(<PageHeader title="タイトル" />);
    // nav スロットなし → 追加要素が存在しない
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('コンテナに flex レイアウトクラスが適用される', () => {
    const { container } = render(<PageHeader title="タイトル" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex');
  });
});
