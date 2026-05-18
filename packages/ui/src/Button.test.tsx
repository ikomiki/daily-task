import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('子テキストをレンダリングする', () => {
    render(<Button>クリック</Button>);
    expect(screen.getByRole('button', { name: 'クリック' })).toBeDefined();
  });

  it('デフォルトは secondary バリアントが適用される', () => {
    render(<Button>ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-gray-500');
  });

  it('secondary は size に関わらず px-3 py-1 クラスが適用される', () => {
    const { rerender } = render(<Button variant="secondary">ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-1');

    rerender(
      <Button variant="secondary" size="sm">
        ボタン
      </Button>,
    );
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-1');
  });

  it('destructive は size に関わらず px-3 py-1 クラスが適用される', () => {
    const { rerender } = render(<Button variant="destructive">ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-1');

    rerender(
      <Button variant="destructive" size="sm">
        ボタン
      </Button>,
    );
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-1');
  });

  it('variant="primary" は bg-game-accent クラスが適用される', () => {
    render(<Button variant="primary">主要</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-game-accent');
  });

  it('variant="destructive" は border-red-500 クラスが適用される', () => {
    render(<Button variant="destructive">削除</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-red-500');
  });

  it('size="sm" のとき primary は px-3 py-1 クラスが適用される', () => {
    render(
      <Button variant="primary" size="sm">
        小
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-1');
  });

  it('disabled 時に disabled:opacity-50 クラスが付与されている', () => {
    render(
      <Button variant="primary" disabled>
        無効
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('disabled:opacity-50');
  });

  it('追加の HTML button 属性が伝播される', () => {
    render(<Button type="submit">送信</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.type).toBe('submit');
  });
});
