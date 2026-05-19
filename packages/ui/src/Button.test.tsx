import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('子テキストをレンダリングする', () => {
    render(<Button>クリック</Button>);
    expect(screen.getByRole('button', { name: 'クリック' })).toBeDefined();
  });

  it('デフォルトは secondary バリアントが適用される', () => {
    render(<Button>ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-border-strong');
  });

  it('secondary md は px-3.5 py-1.5 クラスが適用される', () => {
    render(<Button variant="secondary">ボタン</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-3.5');
    expect(btn.className).toContain('py-1.5');
  });

  it('secondary sm は px-2.5 py-1 クラスが適用される', () => {
    render(
      <Button variant="secondary" size="sm">
        ボタン
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-2.5');
    expect(btn.className).toContain('py-1');
  });

  it('destructive md は border-cal-fail/60 クラスが適用される', () => {
    render(<Button variant="destructive">削除</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border-cal-fail/60');
  });

  it('variant="primary" は bg-game-accent クラスが適用される', () => {
    render(<Button variant="primary">主要</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-game-accent');
  });

  it('variant="destructive" は text-red-300 クラスが適用される', () => {
    render(<Button variant="destructive">削除</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('text-red-300');
  });

  it('size="sm" のとき primary は px-2.5 py-1 クラスが適用される', () => {
    render(
      <Button variant="primary" size="sm">
        小
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-2.5');
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

  it('デフォルト（primary, md）は px-3.5 py-1.5 を持つ', () => {
    render(<Button variant="primary">テスト</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3.5', 'py-1.5');
  });

  it('onClick ハンドラが呼ばれる', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>テスト</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('block=true のとき w-full クラスが付与される', () => {
    render(<Button block>ブロック</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });

  it('block が未指定のとき w-full クラスが付与されない', () => {
    render(<Button>通常</Button>);
    expect(screen.getByRole('button').className).not.toContain('w-full');
  });
});
