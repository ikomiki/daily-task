import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader.js';

describe('PageHeader', () => {
  it('タイトルをレンダリングする', () => {
    render(<PageHeader title="テストタイトル" />);
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.getByText('テストタイトル')).toBeDefined();
  });

  it('subtitle を渡したとき表示される', () => {
    render(<PageHeader title="テスト" subtitle="サブタイトル" />);
    expect(screen.getByText('サブタイトル')).toBeInTheDocument();
  });

  it('right を渡したとき右スロットにレンダリングされる', () => {
    render(<PageHeader title="テスト" right={<button type="button">追加</button>} />);
    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument();
  });

  it('subtitle が未指定の場合は表示しない', () => {
    const { container } = render(<PageHeader title="タイトル" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('コンテナに flex レイアウトクラスが適用される', () => {
    const { container } = render(<PageHeader title="タイトル" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex');
  });
});
