import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card.js';

describe('Card', () => {
  it('子要素をレンダリングする', () => {
    render(<Card>カード内容</Card>);
    expect(screen.getByText('カード内容')).toBeDefined();
  });

  it('デフォルトのボーダークラスが適用される', () => {
    const { container } = render(<Card>内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('border-gray-700');
    expect(el.className).toContain('rounded');
  });

  it('追加の className がマージされる', () => {
    const { container } = render(<Card className="extra-class">内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('extra-class');
    expect(el.className).toContain('border-gray-700');
  });

  it('className が未指定の場合でも正常にレンダリングされる', () => {
    const { container } = render(<Card>内容</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toBe('rounded border border-gray-700 p-3');
  });
});
