import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card.js';

describe('Card', () => {
  it('子要素をレンダリングする', () => {
    render(<Card>カード内容</Card>);
    expect(screen.getByText('カード内容')).toBeDefined();
  });

  it('デフォルト（surface）は border-border-default クラスが適用される', () => {
    const { container } = render(<Card>内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('border-border-default');
    expect(el.className).toContain('rounded-md');
  });

  it('追加の className がマージされる', () => {
    const { container } = render(<Card className="extra-class">内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('extra-class');
    expect(el.className).toContain('border-border-default');
  });

  it('className が未指定の場合でも正常にレンダリングされる', () => {
    const { container } = render(<Card>内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-md');
    expect(el.className).toContain('bg-surface-1');
  });

  it('tone="flat" は border-dashed クラスが適用される', () => {
    const { container } = render(<Card tone="flat">内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('border-dashed');
    expect(el.className).toContain('bg-transparent');
  });
});
