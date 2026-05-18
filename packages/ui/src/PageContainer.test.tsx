import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageContainer } from './PageContainer.js';

describe('PageContainer', () => {
  it('子要素をレンダリングする', () => {
    render(<PageContainer>コンテンツ</PageContainer>);
    expect(screen.getByText('コンテンツ')).toBeDefined();
  });

  it('デフォルト（normal）のクラスが適用される', () => {
    const { container } = render(<PageContainer>内容</PageContainer>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('max-w-2xl');
  });

  it('width="narrow" のときに max-w-md が適用される', () => {
    const { container } = render(<PageContainer width="narrow">内容</PageContainer>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('max-w-md');
  });

  it('width="normal" のときに max-w-2xl が適用される', () => {
    const { container } = render(<PageContainer width="normal">内容</PageContainer>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('max-w-2xl');
  });
});
