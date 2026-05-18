import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextInput } from './TextInput.js';

describe('TextInput', () => {
  it('ラベルとインプットをレンダリングする', () => {
    render(<TextInput label="名前" />);
    expect(screen.getByText('名前')).toBeDefined();
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('label がインプットと紐付いている（label 要素内に input が存在する）', () => {
    const { container } = render(<TextInput label="名前" />);
    const labelEl = container.querySelector('label');
    expect(labelEl).toBeTruthy();
    expect(labelEl?.querySelector('input')).toBeTruthy();
  });

  it('errorMessage が渡された場合に表示される', () => {
    render(<TextInput label="名前" errorMessage="必須項目です" />);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('必須項目です')).toBeDefined();
  });

  it('errorMessage が未指定の場合は alert を表示しない', () => {
    render(<TextInput label="名前" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('追加の input 属性が伝播される', () => {
    render(<TextInput label="名前" placeholder="入力してください" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('入力してください');
  });
});
