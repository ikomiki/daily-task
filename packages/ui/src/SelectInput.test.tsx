import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SelectInput } from './SelectInput.js';

const OPTIONS = [
  { value: 'a', label: '選択肢A' },
  { value: 'b', label: '選択肢B' },
] as const;

describe('SelectInput', () => {
  it('ラベルとセレクトをレンダリングする', () => {
    render(<SelectInput label="カテゴリ" options={OPTIONS} />);
    expect(screen.getByText('カテゴリ')).toBeDefined();
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('オプションが正しくレンダリングされる', () => {
    render(<SelectInput label="カテゴリ" options={OPTIONS} />);
    expect(screen.getByRole('option', { name: '選択肢A' })).toBeDefined();
    expect(screen.getByRole('option', { name: '選択肢B' })).toBeDefined();
  });

  it('label が select と紐付いている（label 要素内に select が存在する）', () => {
    const { container } = render(<SelectInput label="カテゴリ" options={OPTIONS} />);
    const labelEl = container.querySelector('label');
    expect(labelEl).toBeTruthy();
    expect(labelEl?.querySelector('select')).toBeTruthy();
  });

  it('追加の select 属性が伝播される', () => {
    render(<SelectInput label="カテゴリ" options={OPTIONS} defaultValue="b" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('b');
  });
});
